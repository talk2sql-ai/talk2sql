import os
import re
import json
import datetime
from typing import Optional, Any, Dict, List

import httpx
import sqlglot
from sqlglot import exp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect
from collections import deque, defaultdict
from supabase import create_client

load_dotenv()

app = FastAPI(title="Text2SQL MVP (MySQL + OpenRouter)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ----------------------------
# In-memory schema cache (MVP)
# ----------------------------
SCHEMA_CACHE: Dict[str, Any] = {}

# ----------------------------
# Safety / Guardrails
# ----------------------------
DANGEROUS = re.compile(r"\b(drop|delete|truncate|alter|update|insert|create)\b", re.IGNORECASE)

def enforce_safety(sql: str) -> str:
    if DANGEROUS.search(sql):
        raise HTTPException(status_code=400, detail="Blocked: dangerous SQL detected.")
    return sql

def enforce_limit(sql: str, default_limit: int = 100) -> str:
    s = sql.strip().rstrip(";")
    # Only apply to SELECT-like queries; if parse fails, skip
    try:
        parsed = sqlglot.parse_one(s, read="mysql")
    except Exception:
        return s

    # sqlglot expressions have .key like "select"
    if getattr(parsed, "key", "") == "select":
        if "limit" not in s.lower():
            return f"{s} LIMIT {default_limit}"
    return s

def find_closest_column(full_schema: dict, table_name: str, bad_col: str) -> Optional[str]:
    """
    Very simple similarity matcher: tries exact, then substring, then best overlap.
    """
    tables = full_schema.get("tables", {})
    tinfo = tables.get(table_name) or {}
    cols = [c["name"] for c in tinfo.get("columns", [])]

    bad = bad_col.lower()

    # exact case-insensitive match
    for c in cols:
        if c.lower() == bad:
            return c

    # substring match
    for c in cols:
        if bad in c.lower() or c.lower() in bad:
            return c

    # token overlap score
    bad_tokens = set(re.findall(r"[a-zA-Z]+", bad))
    best = None
    best_score = 0
    for c in cols:
        c_tokens = set(re.findall(r"[a-zA-Z]+", c.lower()))
        score = len(bad_tokens.intersection(c_tokens))
        if score > best_score:
            best_score = score
            best = c

    return best

def validate_sql(sql: str, dialect: str = "mysql") -> None:
    try:
        sqlglot.parse_one(sql, read=dialect)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL invalid for {dialect}: {str(e)}")

def clean_sql_only(text: str) -> str:
    if not text:
        return ""

    t = text.strip()

    # Remove starting/ending markdown fences if present
    t = re.sub(r"^```[\w]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    t = t.strip()

    # Grab the first SQL-like statement (WITH/SELECT/EXPLAIN)
    stmts = re.findall(r"(?is)(?:\bwith\b|\bselect\b|\bexplain\b)[\s\S]*?(?=;|$)", t)
    if stmts:
        return stmts[0].strip().strip(";").strip()

    # Fallback: return trimmed text
    return t.strip().strip(";").strip()



# ----------------------------
# OpenRouter LLM
# ----------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

async def openrouter_chat(system: str, user: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")

    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENROUTER_API_KEY in .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # Optional but recommended:
        "HTTP-Referer": "http://localhost",
        "X-Title": "Text2SQL-MVP",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        try:
            r.raise_for_status()
        except Exception:
            raise HTTPException(status_code=400, detail=f"OpenRouter error: {r.text}")
        data = r.json()

    return data["choices"][0]["message"]["content"]

# ----------------------------
# Prompts
# ----------------------------
SYSTEM_GENERATE = """You are a senior analytics engineer. Generate MySQL 8 SQL only.
Rules:
- Output ONLY SQL. No markdown. No explanation.
- Use ONLY tables/columns provided in the schema. Never invent names.
- Prefer explicit JOIN conditions using known keys.
- Default to safe read-only SELECT queries.
- Never output destructive statements (DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE/CREATE).
- If ambiguous, choose the single best query with reasonable assumptions.
"""

SYSTEM_FIX = """You are a MySQL 8 SQL expert. Fix SQL only.

Rules (must follow):
- Output ONLY corrected MySQL SQL. No markdown. No explanation.
- Preserve the user's intent.
- Use ONLY tables/columns provided in the schema JSON. Never invent names.
- If a column name is wrong, REPLACE it with the closest existing column from the same table (by meaning/name similarity).
- Do NOT replace an unknown column with '*' or remove the column unless absolutely necessary.
- Never output destructive statements (DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE/CREATE).
- Always return a non-empty SQL statement.
"""

SYSTEM_EXPLAIN = """You are a senior analytics engineer. Explain the SQL for a business user.

Output format (plain text, no markdown):
1) Summary (1-2 lines)
2) What it returns (bullets)
3) Filters/joins (bullets)
4) Assumptions & risks (bullets)
Keep it concise but complete.
Do NOT modify the SQL.
"""

SYSTEM_OPTIMIZE = """You are a MySQL performance engineer.

Rules (must follow):
- Output ONLY an improved MySQL SQL query. No markdown. No explanation.
- Keep results identical to the original query intent.
- Use ONLY tables/columns provided in the schema JSON. Never invent names.
- NEVER use SELECT * or table.* (c.* / o.*). Always select explicit columns.
- Push filters as early as possible and avoid unnecessary columns/joins.
- Never output destructive statements.
- Always return a non-empty SQL statement.
"""

SYSTEM_SUGGEST = """You are a senior data analyst copilot for MySQL.
Given a schema plus the user's last question/SQL/context, propose the next best SQL queries the user might want to run.

Rules:
- Output valid JSON only (no markdown).
- Propose exactly k suggestions if possible.
- Each suggestion must be a high-quality, practical MySQL query.
- Use only tables/columns that exist in schema.
- Rank them by relevance to the user's current context.
Return JSON with keys: 
  - queries: list of objects { "sql": "...", "title": "..." }
  - joins: list of string join hints
  - checks: list of string data quality checks
"""

def build_generate_user_prompt(question: str, schema_subset: dict, constraints: Optional[str], limit: int) -> str:
    return f"""Question: {question}
Constraints: {constraints or "None"}
Result limit: {limit}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return a single MySQL query."""
def build_fix_user_prompt(sql: str, error: str, schema_subset: dict) -> str:
    return f"""SQL to fix:
{sql}

Error / problem:
{error}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return ONLY corrected MySQL SQL."""
def build_explain_user_prompt(sql: str) -> str:
    return f"""SQL:
{sql}

Explain it with bullet points."""
def build_optimize_user_prompt(sql: str, schema_subset: dict) -> str:
    return f"""SQL:
{sql}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return ONLY optimized MySQL SQL with same intent."""
def build_suggest_user_prompt(schema_subset: dict, question: Optional[str], sql: Optional[str], sample_rows_json: Optional[str], k: int) -> str:
    return f"""k={k}

Last user question:
{question or "None"}

Last SQL:
{sql or "None"}

Optional sample rows (JSON, may be None):
{sample_rows_json or "None"}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return JSON with keys suggestions, joins, checks."""
def safe_parse_json(text: str) -> dict:
    t = text.strip()
    # Remove fences if any
    t = re.sub(r"^```[\w]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()

    # Try direct JSON
    try:
        return json.loads(t)
    except Exception:
        # Attempt to extract first {...}
        m = re.search(r"(\{[\s\S]*\})", t)
        if not m:
            raise ValueError("No JSON object found.")
        return json.loads(m.group(1))


# ----------------------------
# Schema ingestion (MySQL)
# ----------------------------
'''
def ingest_mysql_schema(connection_uri: str) -> dict:
    engine = create_engine(connection_uri)
    insp = inspect(engine)

    schema = {"tables": {}}

    for table in insp.get_table_names():
        cols = insp.get_columns(table)
        pks = insp.get_pk_constraint(table).get("constrained_columns", []) or []
        fks = insp.get_foreign_keys(table) or []

        schema["tables"][table] = {
            "columns": [{"name": c["name"], "type": str(c["type"])} for c in cols],
            "primary_keys": pks,
            "foreign_keys": [
                {
                    "constrained_columns": fk.get("constrained_columns", []),
                    "referred_table": fk.get("referred_table"),
                    "referred_columns": fk.get("referred_columns", []),
                }
                for fk in fks
            ],
        }

    return schema
    '''
# ----------------------------
# Schema upload (MySQL)
# ----------------------------
def extract_create_table_blocks(schema_sql: str) -> list[str]:
    """
    Extract each CREATE TABLE ...; block from a multi-statement schema.
    Works even if sqlglot fails on the whole file.
    """
    if not schema_sql:
        return []
    # Match from CREATE TABLE up to the next semicolon
    blocks = re.findall(r"(?is)\bcreate\s+table\b[\s\S]*?;", schema_sql)
    return [b.strip() for b in blocks if b.strip()]

def normalize_mysql_create_table_block(block: str) -> str:
    """
    Make MySQL CREATE TABLE more parser-friendly:
    - Remove KEY/INDEX lines
    - Remove named CONSTRAINT prefix (keeps the FK)
    - Ensure commas don't break after removals
    """
    lines = block.splitlines()
    kept = []

    for line in lines:
        s = line.strip()

        # Drop KEY / INDEX lines (these are optional for Text2SQL and often break parsers)
        if re.match(r"(?i)^(key|index)\s+`?.+`?\s*\(", s):
            continue

        # Convert: CONSTRAINT `name` FOREIGN KEY (...) REFERENCES ...
        # into:   FOREIGN KEY (...) REFERENCES ...
        s = re.sub(r"(?i)^constraint\s+`?[\w\-]+`?\s+(foreign\s+key\s*\()", r"FOREIGN KEY (", s)

        kept.append(s)

    cleaned = "\n".join(kept)

    # Remove accidental ",\n)" or double commas caused by dropping KEY lines
    cleaned = re.sub(r",\s*\)", "\n)", cleaned)
    cleaned = re.sub(r",\s*,", ",", cleaned)

    return cleaned

def extract_foreign_keys_from_block(block_sql: str) -> list[dict]:
    """
    Extract MySQL foreign keys from a CREATE TABLE block using regex.
    Returns list of:
      {"constrained_columns":[...], "referred_table": "...", "referred_columns":[...]}
    """
    fks = []

    pattern = re.compile(
        r"(?is)foreign\s+key\s*\((?P<local>[^)]+)\)\s*references\s+`?(?P<table>[\w\-]+)`?\s*\((?P<ref>[^)]+)\)"
    )

    for m in pattern.finditer(block_sql):
        local_cols = [c.strip().strip("`").strip('"') for c in m.group("local").split(",")]
        ref_table = m.group("table").strip().strip("`").strip('"')
        ref_cols = [c.strip().strip("`").strip('"') for c in m.group("ref").split(",")]

        # clean empties + dedup preserve order
        def dedup(xs):
            seen = set()
            out = []
            for x in xs:
                if x and x not in seen:
                    seen.add(x)
                    out.append(x)
            return out

        local_cols = dedup(local_cols)
        ref_cols = dedup(ref_cols)

        if local_cols and ref_table and ref_cols:
            fks.append({
                "constrained_columns": local_cols,
                "referred_table": ref_table,
                "referred_columns": ref_cols,
            })

    return fks

def schema_from_ddl(schema_sql: str, dialect: str = "mysql") -> dict:
    if not schema_sql or not schema_sql.strip():
        return {"tables": {}}

    tables: Dict[str, Any] = {}

    blocks = extract_create_table_blocks(schema_sql)
    if not blocks:
        return {"tables": {}}

    for block in blocks:
        block_clean = normalize_mysql_create_table_block(block)

        # Parse this single CREATE TABLE
        try:
            st = sqlglot.parse_one(block_clean, read=dialect)
        except Exception:
            continue

        create = st if isinstance(st, exp.Create) else st.find(exp.Create)
        if not create:
            continue

        table_expr = create.this
        if not table_expr:
            continue

        # =========================
        # ✅ CORRECT TABLE NAME EXTRACTION
        # =========================
        table_name = None

        # Normal case: CREATE TABLE customers (...)
        if isinstance(table_expr, exp.Table):
            table_name = table_expr.name

        # Fallback: find first Table node inside
        if not table_name and hasattr(table_expr, "find"):
            t = table_expr.find(exp.Table)
            if isinstance(t, exp.Table):
                table_name = t.name

        if not table_name:
            continue

        table_name = table_name.strip("`").strip('"')

        # =========================

        if table_name not in tables:
            tables[table_name] = {
                "columns": [],
                "primary_keys": [],
                "foreign_keys": [],
            }

            tables[table_name]["foreign_keys"].extend(
                extract_foreign_keys_from_block(block)
                )

        schema_node = create.find(exp.Schema)
        if not schema_node:
            continue

        # -------- Columns --------
        for coldef in schema_node.find_all(exp.ColumnDef):
            col_name = (coldef.this.name or "").strip("`").strip('"')
            dtype = coldef.args.get("kind")
            col_type = (
                dtype.sql(dialect=dialect)
                if isinstance(dtype, exp.DataType)
                else (str(dtype) if dtype else "UNKNOWN")
            )
            tables[table_name]["columns"].append(
                {"name": col_name, "type": col_type}
            )

        # -------- Primary Key --------
        for pk in schema_node.find_all(exp.PrimaryKey):
            pk_cols = []
            for c in pk.find_all(exp.Column):
                if c.name:
                    pk_cols.append(c.name.strip("`").strip('"'))

            # deduplicate
            seen = set()
            pk_cols = [x for x in pk_cols if not (x in seen or seen.add(x))]

            if pk_cols:
                tables[table_name]["primary_keys"] = pk_cols

        # -------- Foreign Keys --------
        '''
        for fk in schema_node.find_all(exp.ForeignKey):
            local_cols = []
            if fk.this:
                for c in fk.this.find_all(exp.Column):
                    if c.name:
                        local_cols.append(c.name.strip("`").strip('"'))

            ref = fk.args.get("reference")
            referred_table = None
            referred_cols = []

            if isinstance(ref, exp.Reference):
                if isinstance(ref.this, exp.Table):
                    referred_table = ref.this.name.strip("`").strip('"')
                for c in ref.find_all(exp.Column):
                    if c.name:
                        referred_cols.append(c.name.strip("`").strip('"'))

            # deduplicate
            def dedup(xs):
                seen = set()
                out = []
                for x in xs:
                    if x and x not in seen:
                        seen.add(x)
                        out.append(x)
                return out

            local_cols = dedup(local_cols)
            referred_cols = dedup(referred_cols)

            if local_cols and referred_table and referred_cols:
                tables[table_name]["foreign_keys"].append({
                    "constrained_columns": local_cols,
                    "referred_table": referred_table,
                    "referred_columns": referred_cols,
                })
                '''

    return {"tables": tables}

def build_fk_edges(schema: dict) -> list[dict]:
    edges = []
    tables = schema.get("tables", {}) or {}
    for tname, tinfo in tables.items():
        for fk in (tinfo.get("foreign_keys") or []):
            edges.append({
                "from_table": tname,
                "from_columns": fk.get("constrained_columns", []),
                "to_table": fk.get("referred_table"),
                "to_columns": fk.get("referred_columns", []),
            })
    return edges

def edge_to_join_sql(edge: dict, left_alias: str = "a", right_alias: str = "b") -> str:
    # a.<from_col> = b.<to_col> for each pair
    pairs = list(zip(edge["from_columns"], edge["to_columns"]))
    conds = [f"{left_alias}.`{l}` = {right_alias}.`{r}`" for l, r in pairs if l and r]
    on_clause = " AND ".join(conds) if conds else "/* missing fk columns */"
    return f"`{edge['from_table']}` {left_alias} JOIN `{edge['to_table']}` {right_alias} ON {on_clause}"

def resolve_table_name(schema: dict, name: str) -> Optional[str]:
    """
    Return the exact table key used in schema (case-insensitive match).
    """
    if not name:
        return None
    tables = schema.get("tables", {}) or {}
    n = name.strip().strip("`").lower()
    for key in tables.keys():
        if key.strip().strip("`").lower() == n:
            return key
    return None

def table_exists(schema: dict, table: str) -> bool:
    return resolve_table_name(schema, table) is not None

def find_join_paths(schema: dict, start: str, goal: str, max_depth: int = 4) -> list[list[dict]]:
    edges = build_fk_edges(schema)
    # undirected adjacency but keep direction info
    adj = defaultdict(list)
    for e in edges:
        adj[e["from_table"]].append(e)
        # reverse edge for traversal (swap from/to, cols)
        rev = {
            "from_table": e["to_table"],
            "from_columns": e["to_columns"],
            "to_table": e["from_table"],
            "to_columns": e["from_columns"],
        }
        adj[rev["from_table"]].append(rev)

    paths = []
    q = deque()
    q.append((start, []))

    while q:
        node, path = q.popleft()
        if len(path) > max_depth:
            continue
        if node == goal and path:
            paths.append(path)
            continue
        for e in adj.get(node, []):
            nxt = e["to_table"]
            if not nxt:
                continue
            # avoid cycles by table repetition in current path
            used_tables = {start}
            for pe in path:
                used_tables.add(pe["to_table"])
            if nxt in used_tables:
                continue
            q.append((nxt, path + [e]))

    return paths


# ----------------------------
# Schema shortlisting (cheap MVP)
# ----------------------------
def shortlist_schema(full_schema: dict, text: str, max_tables: int = 8) -> dict:
    q = set(re.findall(r"[a-zA-Z_]+", text.lower()))
    scored = []

    for t, info in full_schema.get("tables", {}).items():
        tokens = {t.lower()}
        for c in info.get("columns", []):
            tokens.add(c["name"].lower())

        score = len(q.intersection(tokens))
        if score > 0:
            scored.append((score, t))

    scored.sort(reverse=True)
    chosen = [t for _, t in scored[:max_tables]]

    if not chosen:
        chosen = list(full_schema.get("tables", {}).keys())[:max_tables]

    return {"tables": {t: full_schema["tables"][t] for t in chosen}}

# ----------------------------
# API Models
# ----------------------------
class UploadSchemaRequest(BaseModel):
    db_key: str = "default"
    schema_sql: Optional[str] = None   # paste CREATE TABLE... statements
    schema_json: Optional[dict] = None # optional, if you ever support direct JSON upload
    database_type: Optional[str] = "mysql"

class UserAuthRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    user: Dict[str, Any]
    message: str

#class IngestSchemaRequest(BaseModel):
    # keep this ONLY if you want dev mode to connect DB
    #connection_uri: str
    #db_key: str = "default"

class Text2SQLRequest(BaseModel):
    db_key: str = "default"
    question: str
    constraints: Optional[str] = None
    max_rows: int = 100

class SuggestNextRequest(BaseModel):
    db_key: str = "default"
    question: Optional[str] = None
    sql: Optional[str] = None
    # Optional: paste first few rows as JSON string from UI if you have it
    sample_rows_json: Optional[str] = None
    max_suggestions: int = 8

class SuggestNextResponse(BaseModel):
    queries: list[dict] # list of {sql, title}
    joins: list[str]
    checks: list[str]
    notes: Optional[str] = None

class FixSQLRequest(BaseModel):
    db_key: str = "default"
    sql: str
    error: Optional[str] = None  # if you have a DB error message, pass it here

class ExplainSQLRequest(BaseModel):
    sql: str

class OptimizeSQLRequest(BaseModel):
    db_key: str = "default"
    sql: str

class SQLResponse(BaseModel):
    sql: str
    notes: Optional[str] = None

class ExplainResponse(BaseModel):
    explanation: str

class SuggestJoinsRequest(BaseModel):
    db_key: str = "default"
    tables: Optional[list[str]] = None   # if provided, suggest joins among these
    from_table: Optional[str] = None     # if provided, join path from -> to
    to_table: Optional[str] = None
    max_suggestions: int = 10

class SuggestJoinsResponse(BaseModel):
    joins: list[str]          # human-friendly join clauses
    graph_edges: list[dict]   # structured edges for UI use
    notes: Optional[str] = None


# ----------------------------
# Endpoints
# ----------------------------


@app.post("/api/signup")
async def signup(req: UserAuthRequest):
    try:
        # Check if email already exists in profiles
        existing = supabase.table("profiles").select("id").eq("email", req.email).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="Email already exists")

        # Sign up user with Supabase Auth
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
        })
        
        if not res.user:
             raise HTTPException(status_code=400, detail="Signup failed")
             
        # Create profile
        supabase.table("profiles").insert({
            "id": res.user.id,
            "email": req.email,
            "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).execute()
        
        return {"user": {"email": req.email, "id": res.user.id}, "message": "Signup successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/login")
async def login(req: UserAuthRequest):
    try:
        # Check if email exists in profiles first
        existing = supabase.table("profiles").select("id").eq("email", req.email).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=401, detail="invalid email")

        # Sign in user with Supabase Auth
        try:
            res = supabase.auth.sign_in_with_password({
                "email": req.email,
                "password": req.password,
            })
            
            if not res.user:
                 raise HTTPException(status_code=401, detail="invalid email or password")
                 
            # Update last login
            supabase.table("profiles").update({
                "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }).eq("id", res.user.id).execute()
            
            return {"user": {"email": req.email, "id": res.user.id}, "message": "Login successful"}
        except Exception as e:
            error_str = str(e)
            # If it's a known auth error, we can be specific, otherwise show the error
            if "invalid login credentials" in error_str.lower():
                raise HTTPException(status_code=401, detail="invalid email or password")
            elif "email not confirmed" in error_str.lower():
                raise HTTPException(status_code=401, detail="Email not confirmed. Please check your inbox.")
            else:
                raise HTTPException(status_code=401, detail=f"Authentication error: {error_str}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/upload-schema")
def upload_schema(req: UploadSchemaRequest):
    if not req.schema_sql and not req.schema_json:
        raise HTTPException(status_code=400, detail="Provide schema_sql or schema_json.")

    if req.schema_json:
        schema = req.schema_json
    else:
        schema = schema_from_ddl(req.schema_sql, dialect=req.database_type or "mysql")

    tables = schema.get("tables", {})
    if not isinstance(tables, dict) or len(tables) == 0:
        raise HTTPException(status_code=400, detail="Schema parsing produced 0 tables. Paste valid CREATE TABLE statements.")

    SCHEMA_CACHE[req.db_key] = schema
    return {"status": "ok", "db_key": req.db_key, "tables": len(tables)}

def require_schema(db_key: str) -> dict:
    schema = SCHEMA_CACHE.get(db_key)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found. Run /upload-schema first.")
    return schema

@app.post("/generate-sql", response_model=SQLResponse)
async def generate_sql(req: Text2SQLRequest):
    full_schema = require_schema(req.db_key)
    schema_subset = shortlist_schema(full_schema, req.question, max_tables=8)
    user_prompt = build_generate_user_prompt(
        req.question,
        schema_subset,
        req.constraints,
        req.max_rows
    )
    raw = await openrouter_chat(SYSTEM_GENERATE, user_prompt)
    sql = clean_sql_only(raw)

    sql = enforce_safety(sql)
    sql = enforce_limit(sql, req.max_rows)
    validate_sql(sql, "mysql")

    return SQLResponse(sql=sql, notes="Generated via OpenRouter (MySQL).")


@app.post("/fix-sql", response_model=SQLResponse)
async def fix_sql(req: FixSQLRequest):
    full_schema = require_schema(req.db_key)
    sql_in = clean_sql_only(req.sql)
    if not sql_in:
        raise HTTPException(status_code=400, detail="Empty input SQL.")

    error_msg = (req.error or "").strip()

    # Deterministic replacement if error mentions Unknown column
    m = re.search(r"Unknown column '([^']+)'", error_msg, re.IGNORECASE)
    if m:
        bad_col = m.group(1)
        t = re.search(r"from\s+([a-zA-Z_][\w]*)", sql_in, re.IGNORECASE)
        if t:
            table = t.group(1)
            replacement = find_closest_column(full_schema, table, bad_col)
            if replacement and replacement.lower() != bad_col.lower():
                sql_in = re.sub(rf"\b{re.escape(bad_col)}\b", replacement, sql_in)

    shortlist_text = f"{sql_in}\n{error_msg}"
    schema_subset = shortlist_schema(full_schema, shortlist_text, max_tables=10)

    if not error_msg:
        try:
            sqlglot.parse_one(sql_in, read="mysql")
            error_msg = "SQL may be valid but needs a compatibility/intent-preserving fix."
        except Exception as e:
            error_msg = f"Parse error: {str(e)}"

    # First attempt
    raw1 = await openrouter_chat(SYSTEM_FIX, build_fix_user_prompt(sql_in, error_msg, schema_subset))
    sql1 = clean_sql_only(raw1)

    # Retry once if empty
    if not sql1:
        raw2 = await openrouter_chat(
            SYSTEM_FIX,
            build_fix_user_prompt(
                sql_in,
                error_msg + " IMPORTANT: Output ONLY a single non-empty MySQL query. No fences. No commentary.",
                schema_subset
            )
        )
        sql2 = clean_sql_only(raw2)
        if not sql2:
            raise HTTPException(status_code=400, detail=f"Fixer returned empty SQL. Raw: {raw2[:300]}")
        sql = sql2
        raw_used = raw2
    else:
        sql = sql1
        raw_used = raw1

    sql = enforce_safety(sql)
    sql = enforce_limit(sql, 100)

    # Validate after enforcement
    try:
        validate_sql(sql, "mysql")
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=f"{e.detail}. Raw output: {raw_used[:300]}")

    return SQLResponse(sql=sql, notes="Fixed via deterministic map + OpenRouter (retry-on-empty).")


@app.post("/explain-sql", response_model=ExplainResponse)
async def explain_sql(req: ExplainSQLRequest):
    sql = clean_sql_only(req.sql)
    sql = enforce_safety(sql)
    validate_sql(sql, "mysql")

    raw = await openrouter_chat(SYSTEM_EXPLAIN, build_explain_user_prompt(sql))
    return ExplainResponse(explanation=raw.strip())

@app.post("/optimize-sql", response_model=SQLResponse)
async def optimize_sql(req: OptimizeSQLRequest):
    full_schema = require_schema(req.db_key)
    sql_in = clean_sql_only(req.sql)
    if not sql_in:
        raise HTTPException(status_code=400, detail="Empty input SQL.")
    sql_in = enforce_safety(sql_in)
    validate_sql(sql_in, "mysql")

    schema_subset = shortlist_schema(full_schema, sql_in, max_tables=10)

    # First attempt
    raw1 = await openrouter_chat(SYSTEM_OPTIMIZE, build_optimize_user_prompt(sql_in, schema_subset))
    sql1 = clean_sql_only(raw1)

    # Retry once if empty or invalid
    if not sql1:
        raw2 = await openrouter_chat(
            SYSTEM_OPTIMIZE,
            build_optimize_user_prompt(
                sql_in + "\n\nIMPORTANT: Output only a single non-empty MySQL query. No fences. No commentary.",
                schema_subset
            )
        )
        sql2 = clean_sql_only(raw2)
        if not sql2:
            raise HTTPException(status_code=400, detail=f"Optimizer returned empty SQL. Raw: {raw2[:300]}")
        sql = sql2
    else:
        sql = sql1

    sql = enforce_safety(sql)
    validate_sql(sql, "mysql")

    # Hard rule: reject SELECT * outputs
    if re.search(r"(?i)\bselect\s+\*\b|\b\w+\.\*\b", sql):
        raise HTTPException(status_code=400, detail=f"Optimizer violated rule (SELECT *). Raw output: {raw1[:300]}")

    return SQLResponse(sql=sql, notes="Optimized via OpenRouter (explicit columns, no SELECT *).")

@app.post("/suggest-next", response_model=SuggestNextResponse)
async def suggest_next(req: SuggestNextRequest):
    full_schema = require_schema(req.db_key)
    shortlist_text = f"{req.question or ''}\n{req.sql or ''}\n{req.sample_rows_json or ''}"
    schema_subset = shortlist_schema(full_schema, shortlist_text, max_tables=12)

    user_prompt = build_suggest_user_prompt(
        schema_subset=schema_subset,
        question=req.question,
        sql=req.sql,
        sample_rows_json=req.sample_rows_json,
        k=req.max_suggestions
    )

    raw = await openrouter_chat(SYSTEM_SUGGEST, user_prompt)
    try:
        data = safe_parse_json(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Suggestions JSON parse failed: {str(e)}. Raw: {raw[:300]}")

    queries = data.get("queries", []) or data.get("suggestions", [])
    # Convert old format if needed
    if queries and isinstance(queries[0], str):
        queries = [{"sql": q, "title": f"Suggestion {i+1}"} for i, q in enumerate(queries)]
        
    joins = data.get("joins", [])
    checks = data.get("checks", [])

    # Clamp sizes
    queries = queries[:req.max_suggestions]
    joins = joins[:8]
    checks = checks[:8]

    return SuggestNextResponse(
        queries=queries,
        joins=joins,
        checks=checks,
        notes=f"Generated {len(queries)} suggestions based on k={req.max_suggestions}"
    )

@app.post("/suggest-joins", response_model=SuggestJoinsResponse)
def suggest_joins(req: SuggestJoinsRequest):
    schema = require_schema(req.db_key)

    edges = build_fk_edges(schema)
    joins_out = []
    graph_edges = []

    # Case 1: from_table -> to_table path
    if req.from_table and req.to_table:
        from_t = resolve_table_name(schema, req.from_table)
        to_t = resolve_table_name(schema, req.to_table)

        if not from_t or not to_t:
            raise HTTPException(status_code=400, detail="from_table or to_table not found in schema.")

        paths = find_join_paths(schema, from_t, to_t, max_depth=4)

        for path in paths[: req.max_suggestions]:
            chain_sql_parts = []
            aliases = "abcdefghijklmnopqrstuvwxyz"

            # first table (use resolved name)
            chain_sql_parts.append(f"`{from_t}` {aliases[0]}")

            for i, e in enumerate(path, start=1):
                left_alias = aliases[i - 1]
                right_alias = aliases[i]

                join_clause = edge_to_join_sql(e, left_alias=left_alias, right_alias=right_alias)

                # keep only "JOIN ... ON ..."
                join_only = join_clause.split("JOIN", 1)[1]
                chain_sql_parts.append("JOIN" + join_only)

                graph_edges.append(e)

            joins_out.append(" ".join(chain_sql_parts))

        return SuggestJoinsResponse(
            joins=joins_out[: req.max_suggestions],
            graph_edges=graph_edges[: req.max_suggestions],
            notes="Join paths derived from foreign-key graph."
        )

    # Case 2: join suggestions among a set of tables
    if req.tables:
        tables_set = []
        for t in req.tables:
            rt = resolve_table_name(schema, t)
            if rt:
                tables_set.append(rt)

        if len(tables_set) < 2:
            raise HTTPException(status_code=400, detail="Provide at least two valid tables.")

        for e in edges:
            if e["from_table"] in tables_set and e["to_table"] in tables_set:
                graph_edges.append(e)
                joins_out.append(edge_to_join_sql(e, left_alias="a", right_alias="b"))

        # Deduplicate joins
        seen = set()
        joins_unique = []
        for j in joins_out:
            if j not in seen:
                seen.add(j)
                joins_unique.append(j)

        return SuggestJoinsResponse(
            joins=joins_unique[: req.max_suggestions],
            graph_edges=graph_edges[: req.max_suggestions],
            notes="Direct FK joins among provided tables."
        )

    # Default: return all direct FK joins
    for e in edges:
        joins_out.append(edge_to_join_sql(e, left_alias="a", right_alias="b"))
        graph_edges.append(e)

    return SuggestJoinsResponse(
        joins=joins_out[: req.max_suggestions],
        graph_edges=graph_edges[: req.max_suggestions],
        notes="Direct FK joins from schema."
    )



