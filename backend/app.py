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
from collections import deque, defaultdict
from supabase import create_client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Text2SQL MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

SCHEMA_CACHE: Dict[str, Any] = {}

# ----------------------------
# Dialect handling
# ----------------------------
DIALECT_MAP = {
    "mysql": "mysql",
    "postgres": "postgres",
    "postgresql": "postgres",
    "sqlite": "sqlite",
    "sqlite3": "sqlite",
}

def normalize_dialect(db_type: Optional[str]) -> str:
    if not db_type:
        return "mysql"
    t = db_type.lower().strip()
    return DIALECT_MAP.get(t, "mysql")

def get_dialect_name(db_type: str) -> str:
    return {
        "mysql": "MySQL 8",
        "postgres": "PostgreSQL 14+",
        "sqlite": "SQLite 3"
    }.get(normalize_dialect(db_type), "MySQL 8")

# ----------------------------
# Output hygiene (TEXT ONLY)
# ----------------------------
def enforce_single_statement(sql: str) -> str:
    if not sql:
        raise HTTPException(status_code=400, detail="Empty SQL output.")
    parts = [p.strip() for p in sql.split(";") if p.strip()]
    if len(parts) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple SQL statements detected. Please generate one statement at a time."
        )
    return parts[0]

def validate_sql(sql: str, dialect: str):
    try:
        sqlglot.parse_one(sql, read=dialect)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid {dialect} SQL: {str(e)}")

def clean_sql_only(text: str) -> str:
    if not text:
        return ""
    t = text.strip()
    t = re.sub(r"^```[\w]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t)

    starters = r"(with|select|insert|update|delete|create|alter|drop|truncate|merge|replace|grant|revoke|explain)"
    m = re.search(rf"(?is)\b{starters}\b[\s\S]*?(?=;|$)", t)
    if m:
        return m.group(0).strip().strip(";")

    return t.strip().strip(";")

# ----------------------------
# OpenRouter
# ----------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

async def openrouter_chat(system: str, user: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL")

    if not api_key or not model:
        raise HTTPException(status_code=500, detail="OpenRouter not configured")

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
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

# ----------------------------
# SYSTEM PROMPTS (DYNAMIC)
# ----------------------------
def get_system_prompt(mode: str, db_type: str) -> str:
    dialect = normalize_dialect(db_type)

    base = f"""
You are an expert SQL engineer.
You MUST use {get_dialect_name(db_type)} syntax ONLY.
Output ONLY SQL. No markdown. No explanations.
Use ONLY tables and columns from the schema.
Generate exactly ONE SQL statement.
"""

    if mode == "explain":
        return f"You are a {get_dialect_name(db_type)} expert. Explain the SQL clearly using bullet points."

    if mode == "suggest":
        return f"""
You are a {get_dialect_name(db_type)} analyst.
Return valid JSON ONLY with keys:
queries (list of {{sql, title}}), joins, checks.
"""

    return base

# ----------------------------
# Schema ingestion
# ----------------------------
def split_create_table_statements(ddl: str) -> List[str]:
    if not ddl:
        return []
    stmts = []
    current = []
    depth = 0
    for line in ddl.splitlines():
        if line.strip().startswith("--"):
            continue
        current.append(line)
        depth += line.count("(") - line.count(")")
        if ";" in line and depth <= 0:
            stmt = "\n".join(current).split(";")[0].strip()
            if stmt:
                stmts.append(stmt)
            current = []
    return stmts

def schema_from_ddl(ddl: str, dialect: str) -> dict:
    tables = {}
    errors = []
    stmts = split_create_table_statements(ddl)
    for s in stmts:
        try:
            parsed = sqlglot.parse_one(s, read=dialect)
            if not isinstance(parsed, exp.Create):
                continue
            name = parsed.this.this.name
            tables[name] = {"columns": []}
            for col in parsed.this.expressions:
                if isinstance(col, exp.ColumnDef):
                    tables[name]["columns"].append({
                        "name": col.this.name,
                        "type": str(col.kind)
                    })
        except Exception as e:
            errors.append(str(e))
    return {"tables": tables, "parse_errors": errors}

# ----------------------------
# API MODELS
# ----------------------------
class UserAuthRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    user: Dict[str, Any]
    message: str
    
class UploadSchemaRequest(BaseModel):
    db_key: str = "default"
    schema_sql: str
    database_type: str = "mysql"

class Text2SQLRequest(BaseModel):
    db_key: str = "default"
    question: str
    database_type: str = "mysql"

class FixSQLRequest(BaseModel):
    db_key: str = "default"
    sql: str
    database_type: str = "mysql"

class ExplainSQLRequest(BaseModel):
    sql: str
    database_type: str = "mysql"

class SQLResponse(BaseModel):
    sql: str
    notes: Optional[str] = None

class ExplainResponse(BaseModel):
    explanation: str

# ----------------------------
# Helpers
# ----------------------------
def require_schema(db_key: str) -> dict:
    if db_key not in SCHEMA_CACHE:
        raise HTTPException(status_code=404, detail="Schema not uploaded")
    return SCHEMA_CACHE[db_key]

# ----------------------------
# ENDPOINTS
# ----------------------------
@app.post("/api/signup")
async def signup(req: UserAuthRequest):
    try:
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
        })

        if not res.user:
            raise HTTPException(status_code=400, detail={"error": "signup_failed", "message": "Signup failed. Please try again."})

        # Profile upsert (don’t hard-fail if RLS blocks it)
        try:
            supabase.table("profiles").upsert({
                "id": res.user.id,
                "email": req.email,
                "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }, on_conflict="id").execute()
        except Exception as e:
            logger.warning(f"Profile upsert failed (likely RLS), ignoring: {e}")

        return {
            "user": {"email": req.email, "id": res.user.id},
            "message": "Signup successful. Check your email to confirm."
        }

    except Exception as e:
        msg = str(e).lower()
        if "user already registered" in msg or "already exists" in msg:
            raise HTTPException(status_code=400, detail={"error": "email_exists", "message": "Email already exists."})
        raise HTTPException(status_code=400, detail={"error": "signup_failed", "message": "Signup failed. Please try again."})


@app.post("/api/login")
async def login(req: UserAuthRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })

        if not res.user:
            raise HTTPException(status_code=401, detail={"error": "invalid_credentials", "message": "Invalid email or password"})

        # Best-effort profile upsert (don’t break login)
        try:
            supabase.table("profiles").upsert({
                "id": res.user.id,
                "email": req.email,
                "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }, on_conflict="id").execute()
        except Exception as e:
            logger.warning(f"Profile upsert failed (likely RLS), ignoring: {e}")

        return {"user": {"email": req.email, "id": res.user.id}, "message": "Login successful"}

    except Exception as e:
        error_str = str(e).lower()
        if "invalid login credentials" in error_str:
            raise HTTPException(status_code=401, detail={"error": "invalid_credentials", "message": "Invalid email or password"})
        if "email not confirmed" in error_str:
            raise HTTPException(status_code=401, detail={"error": "email_not_confirmed", "message": "Email not confirmed. Please verify your email."})
        raise HTTPException(status_code=401, detail={"error": "auth_error", "message": "Authentication failed"})

@app.post("/upload-schema")
def upload_schema(req: UploadSchemaRequest):
    dialect = normalize_dialect(req.database_type)
    schema = schema_from_ddl(req.schema_sql, dialect)

    if not schema["tables"]:
        raise HTTPException(status_code=400, detail="No tables parsed from schema.")

    SCHEMA_CACHE[req.db_key] = schema
    return {
        "status": "ok",
        "tables": len(schema["tables"]),
        "warning": "Ensure schema matches selected database type."
    }

@app.post("/generate-sql", response_model=SQLResponse)
async def generate_sql(req: Text2SQLRequest):
    schema = require_schema(req.db_key)
    dialect = normalize_dialect(req.database_type)

    system = get_system_prompt("generate", req.database_type)
    user = f"Question:\n{req.question}\nSchema:\n{json.dumps(schema, indent=2)}"

    raw = await openrouter_chat(system, user)
    sql = enforce_single_statement(clean_sql_only(raw))
    validate_sql(sql, dialect)

    return SQLResponse(sql=sql)

@app.post("/fix-sql", response_model=SQLResponse)
async def fix_sql(req: FixSQLRequest):
    schema = require_schema(req.db_key)
    dialect = normalize_dialect(req.database_type)

    system = get_system_prompt("fix", req.database_type)
    user = f"Fix this SQL:\n{req.sql}\nSchema:\n{json.dumps(schema, indent=2)}"

    raw = await openrouter_chat(system, user)
    sql = enforce_single_statement(clean_sql_only(raw))
    validate_sql(sql, dialect)

    return SQLResponse(sql=sql)

@app.post("/explain-sql", response_model=ExplainResponse)
async def explain_sql(req: ExplainSQLRequest):
    system = get_system_prompt("explain", req.database_type)
    raw = await openrouter_chat(system, req.sql)
    return ExplainResponse(explanation=raw.strip())

