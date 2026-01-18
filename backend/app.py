import os
import re
import json
import datetime
import logging
from typing import Optional, Any, Dict, List

import httpx
import sqlglot
from sqlglot import exp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ----------------------------
# App + Logging
# ----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("text2sql")

app = FastAPI(title="Text2SQL MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Supabase
# ----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("Supabase env missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL or "", SUPABASE_SERVICE_ROLE_KEY or "")

# ----------------------------
# Cache (schema + dialect + parse errors)
# ----------------------------
# SCHEMA_CACHE[db_key] = {"schema": {...}, "dialect": "postgres", "parse_errors": [...]}
SCHEMA_CACHE: Dict[str, Dict[str, Any]] = {}

# ----------------------------
# Dialect handling
# ----------------------------
DIALECT_MAP = {
    "mysql": "mysql",
    "postgres": "postgres",
    "postgresql": "postgres",
    "pg": "postgres",
    "sqlite": "sqlite",
    "sqlite3": "sqlite",
}

DIALECT_DISPLAY = {
    "mysql": "MySQL 8",
    "postgres": "PostgreSQL 14+",
    "sqlite": "SQLite 3",
}

def normalize_dialect(db_type: Optional[str]) -> str:
    if not db_type:
        return "mysql"
    t = db_type.lower().strip()
    return DIALECT_MAP.get(t, "mysql")

def get_dialect_name(normalized_dialect: str) -> str:
    return DIALECT_DISPLAY.get(normalized_dialect, "MySQL 8")

def resolve_effective_dialect(db_key: str, request_db_type: Optional[str]) -> str:
    """
    Priority:
    1) If request_db_type provided -> use it
    2) Else use cached dialect for this db_key
    3) Else default mysql
    """
    if request_db_type:
        return normalize_dialect(request_db_type)
    cached = SCHEMA_CACHE.get(db_key)
    if cached and cached.get("dialect"):
        return cached["dialect"]
    return "mysql"

# ----------------------------
# Output hygiene
# ----------------------------
def clamp_int(x: int, lo: int, hi: int) -> int:
    try:
        v = int(x)
    except Exception:
        return lo
    return max(lo, min(hi, v))

def enforce_single_statement(sql: str) -> str:
    if not sql:
        raise HTTPException(status_code=400, detail="Empty SQL output.")
    parts = [p.strip() for p in sql.split(";") if p.strip()]
    if len(parts) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple SQL statements detected. Generate one statement only."
        )
    return parts[0].strip()

def clean_sql_only(text: str) -> str:
    """
    Extract first SQL-like statement. Removes markdown fences.
    """
    if not text:
        return ""
    t = text.strip()
    t = re.sub(r"^```[\w]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()

    starters = r"(with|select|insert|update|delete|create|alter|drop|truncate|merge|replace|grant|revoke|explain)"
    m = re.search(rf"(?is)\b{starters}\b[\s\S]*?(?=;|$)", t)
    if m:
        return m.group(0).strip().strip(";").strip()

    return t.strip().strip(";").strip()

def validate_sql(sql: str, dialect: str) -> None:
    try:
        sqlglot.parse_one(sql, read=dialect)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid {dialect} SQL: {str(e)}")

def enforce_limit(sql: str, limit: int, dialect: str) -> str:
    """
    Adds LIMIT if query is a SELECT and has no LIMIT.
    Dialect aware: mysql/postgres/sqlite all accept LIMIT.
    """
    s = sql.strip().rstrip(";")
    try:
        parsed = sqlglot.parse_one(s, read=dialect)
    except Exception:
        return s  # can't parse, don't mutate

    if getattr(parsed, "key", "") == "select":
        if "limit" not in s.lower():
            return f"{s} LIMIT {limit}"
    return s

# ----------------------------
# OpenRouter
# ----------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

async def openrouter_chat(system: str, user: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL")
    if not api_key or not model:
        raise HTTPException(status_code=500, detail="OpenRouter not configured (OPENROUTER_API_KEY / OPENROUTER_MODEL).")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Text2SQL",
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
# System prompts (dialect-specific)
# ----------------------------
def system_generate(dialect: str) -> str:
    return f"""
You are an expert SQL engineer.
You MUST use {get_dialect_name(dialect)} syntax ONLY.
Output ONLY SQL. No markdown. No explanations.
Use ONLY tables and columns from the schema JSON.
Generate exactly ONE SQL statement.
If ambiguous, pick the most reasonable query.
"""

def system_fix(dialect: str) -> str:
    return f"""
You are a {get_dialect_name(dialect)} SQL expert.
Fix the SQL to match the schema.
Output ONLY the corrected SQL. No markdown. No explanations.
Generate exactly ONE SQL statement.
Preserve intent.
"""

def system_explain(dialect: str) -> str:
    return f"""
You are a {get_dialect_name(dialect)} expert.
Explain the SQL clearly in bullet points.
No markdown headings. Keep it readable.
"""

def system_optimize(dialect: str) -> str:
    return f"""
You are a {get_dialect_name(dialect)} performance engineer.
Return ONLY an optimized SQL query with the SAME intent.
No markdown. No explanation.
Generate exactly ONE statement.
Do not invent columns/tables.
"""

def system_suggest(dialect: str) -> str:
    return f"""
You are a {get_dialect_name(dialect)} analyst copilot.
Return valid JSON ONLY with keys:
queries (list of objects {{sql, title}}), joins (list of strings), checks (list of strings).
Each sql must be exactly ONE statement.
Use ONLY schema tables/columns.
"""

def safe_parse_json(text: str) -> dict:
    t = (text or "").strip()
    t = re.sub(r"^```[\w]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"(\{[\s\S]*\})", t)
        if not m:
            raise ValueError("No JSON object found.")
        return json.loads(m.group(1))

# ----------------------------
# Schema parsing (DDL -> schema JSON)
# ----------------------------
def split_create_table_statements(ddl: str) -> List[str]:
    """
    Basic splitter for CREATE TABLE blocks.
    """
    if not ddl:
        return []
    stmts = []
    current = []
    depth = 0
    for line in ddl.splitlines():
        # skip SQL comments
        if line.strip().startswith("--"):
            continue
        current.append(line)
        depth += line.count("(") - line.count(")")
        if ";" in line and depth <= 0:
            stmt = "\n".join(current).split(";")[0].strip()
            if stmt:
                stmts.append(stmt)
            current = []
    # in case last statement has no semicolon
    if current:
        stmt = "\n".join(current).strip()
        if stmt:
            stmts.append(stmt)
    return stmts

def schema_from_ddl(ddl: str, dialect: str) -> dict:
    """
    Returns:
    {
      "tables": {
        "table": {"columns": [{"name": "...", "type": "..."}]}
      },
      "parse_errors": [...]
    }
    """
    tables: Dict[str, Any] = {}
    errors: List[str] = []

    stmts = split_create_table_statements(ddl)
    for s in stmts:
        try:
            parsed = sqlglot.parse_one(s, read=dialect)
            if not isinstance(parsed, exp.Create):
                continue

            # CREATE TABLE <this>
            # sqlglot structure varies; these are common safe paths:
            table_expr = parsed.this
            table_name = None

            if isinstance(table_expr, exp.Table):
                table_name = table_expr.name
            else:
                tnode = table_expr.find(exp.Table) if hasattr(table_expr, "find") else None
                if isinstance(tnode, exp.Table):
                    table_name = tnode.name

            if not table_name:
                continue

            if table_name not in tables:
                tables[table_name] = {"columns": []}

            schema_node = parsed.find(exp.Schema)
            if not schema_node:
                continue

            for coldef in schema_node.find_all(exp.ColumnDef):
                col_name = coldef.this.name if coldef.this else None
                dtype = coldef.args.get("kind")
                col_type = dtype.sql(dialect=dialect) if isinstance(dtype, exp.DataType) else (str(dtype) if dtype else "UNKNOWN")
                if col_name:
                    tables[table_name]["columns"].append({"name": col_name, "type": col_type})

        except Exception as e:
            errors.append(str(e))

    return {"tables": tables, "parse_errors": errors}

# ----------------------------
# Schema shortlisting (cheap MVP)
# ----------------------------
def shortlist_schema(full_schema: dict, text: str, max_tables: int = 8) -> dict:
    """
    full_schema = {"tables": {...}, "parse_errors": [...]}
    """
    q = set(re.findall(r"[a-zA-Z_]+", (text or "").lower()))
    scored = []

    tables = (full_schema or {}).get("tables", {}) or {}
    for t, info in tables.items():
        tokens = {t.lower()}
        for c in info.get("columns", []):
            tokens.add((c.get("name") or "").lower())
        score = len(q.intersection(tokens))
        if score > 0:
            scored.append((score, t))

    scored.sort(reverse=True)
    chosen = [t for _, t in scored[:max_tables]]

    if not chosen:
        chosen = list(tables.keys())[:max_tables]

    return {"tables": {t: tables[t] for t in chosen}}

# ----------------------------
# API Models
# ----------------------------
class UserAuthRequest(BaseModel):
    email: str
    password: str

class UploadSchemaRequest(BaseModel):
    db_key: str = "default"
    schema_sql: str
    database_type: str  # REQUIRED from UI (mysql/postgres/sqlite)

class Text2SQLRequest(BaseModel):
    db_key: str = "default"
    question: str
    database_type: Optional[str] = None  # optional; if omitted, use cached dialect
    constraints: Optional[str] = None
    max_rows: int = 100

class FixSQLRequest(BaseModel):
    db_key: str = "default"
    sql: str
    database_type: Optional[str] = None

class ExplainSQLRequest(BaseModel):
    sql: str
    database_type: Optional[str] = None

class OptimizeSQLRequest(BaseModel):
    db_key: str = "default"
    sql: str
    database_type: Optional[str] = None

class SuggestNextRequest(BaseModel):
    db_key: str = "default"
    question: Optional[str] = None
    sql: Optional[str] = None
    sample_rows_json: Optional[str] = None
    max_suggestions: int = 5
    database_type: Optional[str] = None

class SQLResponse(BaseModel):
    sql: str
    notes: Optional[str] = None

class ExplainResponse(BaseModel):
    explanation: str

class SuggestNextResponse(BaseModel):
    queries: List[Dict[str, Any]]
    joins: List[str]
    checks: List[str]
    notes: Optional[str] = None

# ----------------------------
# Helpers
# ----------------------------
def require_cached(db_key: str) -> Dict[str, Any]:
    cached = SCHEMA_CACHE.get(db_key)
    if not cached or not cached.get("schema") or not cached["schema"].get("tables"):
        raise HTTPException(status_code=404, detail="Schema not uploaded for this db_key.")
    return cached

# ----------------------------
# ENDPOINTS (ALL under /api)
# ----------------------------
@app.post("/api/signup")
async def signup(req: UserAuthRequest):
    try:
        res = supabase.auth.sign_up({"email": req.email, "password": req.password})
        if not getattr(res, "user", None):
            raise HTTPException(status_code=400, detail={"error": "signup_failed", "message": "Signup failed."})

        # best-effort profile upsert (ignore if RLS blocks)
        try:
            supabase.table("profiles").upsert({
                "id": res.user.id,
                "email": req.email,
                "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }, on_conflict="id").execute()
        except Exception as e:
            logger.warning(f"Profile upsert failed (ignore): {e}")

        return {"user": {"email": req.email, "id": res.user.id}, "message": "Signup successful. Check your email to confirm."}
    except Exception as e:
        msg = str(e).lower()
        if "already" in msg and "registered" in msg:
            raise HTTPException(status_code=400, detail={"error": "email_exists", "message": "Email already exists."})
        raise HTTPException(status_code=400, detail={"error": "signup_failed", "message": "Signup failed."})

@app.post("/api/login")
async def login(req: UserAuthRequest):
    try:
        res = supabase.auth.sign_in_with_password({"email": req.email, "password": req.password})
        if not getattr(res, "user", None):
            raise HTTPException(status_code=401, detail={"error": "invalid_credentials", "message": "Invalid email or password."})

        try:
            supabase.table("profiles").upsert({
                "id": res.user.id,
                "email": req.email,
                "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }, on_conflict="id").execute()
        except Exception as e:
            logger.warning(f"Profile upsert failed (ignore): {e}")

        return {"user": {"email": req.email, "id": res.user.id}, "message": "Login successful"}
    except Exception as e:
        s = str(e).lower()
        if "email not confirmed" in s:
            raise HTTPException(status_code=401, detail={"error": "email_not_confirmed", "message": "Email not confirmed. Please verify your email."})
        if "invalid login credentials" in s:
            raise HTTPException(status_code=401, detail={"error": "invalid_credentials", "message": "Invalid email or password."})
        raise HTTPException(status_code=401, detail={"error": "auth_error", "message": "Authentication failed."})

@app.post("/api/upload-schema")
def upload_schema_api(req: UploadSchemaRequest):
    dialect = normalize_dialect(req.database_type)
    schema = schema_from_ddl(req.schema_sql, dialect)

    if not schema.get("tables"):
        raise HTTPException(status_code=400, detail="No tables parsed. Ensure DDL matches selected database type.")

    SCHEMA_CACHE[req.db_key] = {
        "schema": schema,
        "dialect": dialect,
        "parse_errors": schema.get("parse_errors", []),
    }

    warning = None
    if schema.get("parse_errors"):
        warning = "Some DDL statements could not be parsed. Ensure DDL matches selected database type."

    return {
        "status": "ok",
        "db_key": req.db_key,
        "tables": len(schema["tables"]),
        "dialect": dialect,
        "warning": warning
    }

@app.post("/api/generate-sql", response_model=SQLResponse)
async def generate_sql_api(req: Text2SQLRequest):
    cached = require_cached(req.db_key)
    dialect = resolve_effective_dialect(req.db_key, req.database_type)
    full_schema = cached["schema"]
    max_rows = clamp_int(req.max_rows, 1, 10000)

    schema_subset = shortlist_schema(full_schema, f"{req.question}\n{req.constraints or ''}", max_tables=8)

    system = system_generate(dialect)
    user = f"""
Question:
{req.question}

Constraints:
{req.constraints or "None"}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return exactly ONE SQL statement for {get_dialect_name(dialect)}.
"""

    raw = await openrouter_chat(system, user)
    sql = enforce_single_statement(clean_sql_only(raw))
    validate_sql(sql, dialect)

    # Optional safety: enforce a LIMIT for SELECTs
    sql = enforce_limit(sql, max_rows, dialect)

    return SQLResponse(sql=sql, notes=f"dialect={dialect}, max_rows={max_rows}")

@app.post("/api/fix-sql", response_model=SQLResponse)
async def fix_sql_api(req: FixSQLRequest):
    cached = require_cached(req.db_key)
    dialect = resolve_effective_dialect(req.db_key, req.database_type)
    full_schema = cached["schema"]

    system = system_fix(dialect)
    user = f"""
Fix this SQL (keep same intent):
{req.sql}

Schema (JSON):
{json.dumps(full_schema, indent=2)}

Return exactly ONE corrected SQL statement for {get_dialect_name(dialect)}.
"""

    raw = await openrouter_chat(system, user)
    sql = enforce_single_statement(clean_sql_only(raw))
    validate_sql(sql, dialect)

    return SQLResponse(sql=sql, notes=f"dialect={dialect}")

@app.post("/api/explain-sql", response_model=ExplainResponse)
async def explain_sql_api(req: ExplainSQLRequest):
    dialect = normalize_dialect(req.database_type) if req.database_type else "mysql"
    system = system_explain(dialect)
    raw = await openrouter_chat(system, req.sql)
    return ExplainResponse(explanation=raw.strip())

@app.post("/api/optimize-sql", response_model=SQLResponse)
async def optimize_sql_api(req: OptimizeSQLRequest):
    cached = require_cached(req.db_key)
    dialect = resolve_effective_dialect(req.db_key, req.database_type)
    full_schema = cached["schema"]

    system = system_optimize(dialect)
    user = f"""
Optimize this SQL (same intent):
{req.sql}

Schema (JSON):
{json.dumps(full_schema, indent=2)}

Return exactly ONE optimized SQL statement for {get_dialect_name(dialect)}.
"""

    raw = await openrouter_chat(system, user)
    sql = enforce_single_statement(clean_sql_only(raw))
    validate_sql(sql, dialect)

    return SQLResponse(sql=sql, notes=f"dialect={dialect}")

@app.post("/api/suggest-next", response_model=SuggestNextResponse)
async def suggest_next_api(req: SuggestNextRequest):
    cached = require_cached(req.db_key)
    dialect = resolve_effective_dialect(req.db_key, req.database_type)
    full_schema = cached["schema"]

    max_suggestions = clamp_int(req.max_suggestions, 1, 10)
    context = f"{req.question or ''}\n{req.sql or ''}\n{req.sample_rows_json or ''}"
    schema_subset = shortlist_schema(full_schema, context, max_tables=12)

    system = system_suggest(dialect)
    user = f"""
k={max_suggestions}

Last question:
{req.question or "None"}

Last SQL:
{req.sql or "None"}

Sample rows (optional JSON):
{req.sample_rows_json or "None"}

Schema (JSON):
{json.dumps(schema_subset, indent=2)}

Return JSON ONLY with keys queries, joins, checks.
Each queries[i].sql must be ONE statement in {get_dialect_name(dialect)}.
"""

    raw = await openrouter_chat(system, user)

    try:
        data = safe_parse_json(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Suggestions JSON parse failed: {str(e)}")

    queries = data.get("queries", []) or []
    joins = data.get("joins", []) or []
    checks = data.get("checks", []) or []

    # sanitize + clamp
    cleaned_queries = []
    for q in queries[:max_suggestions]:
        if isinstance(q, dict) and q.get("sql"):
            sql = enforce_single_statement(clean_sql_only(q["sql"]))
            # validate each suggested SQL for the dialect
            try:
                validate_sql(sql, dialect)
            except Exception:
                continue
            cleaned_queries.append({"sql": sql, "title": q.get("title", "Suggestion")})

    return SuggestNextResponse(
        queries=cleaned_queries,
        joins=[str(x) for x in joins[:8]],
        checks=[str(x) for x in checks[:8]],
        notes=f"dialect={dialect}, returned={len(cleaned_queries)}"
    )
