import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import runs
from app.routes import runs, sessions, add_to_cart
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Agent Navigability Simulator API",
    openapi_url="/v1/openapi.json",
    docs_url="/v1/docs",       
    redoc_url="/v1/redoc"  
)

# CORS will allow the cross domain access (the question we talked before)
# Vercel URL here to allow the JS calls accross origins
# Setting ALLOWED_ORIGINS via env so we don't redeploy for each preview URL.


ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

# allowing all Vercel preview URLs for the project (example: https://.*-app.vercel\.app$)
ALLOWED_ORIGINS_REGEX = os.getenv("ALLOWED_ORIGINS_REGEX")  

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if not ALLOWED_ORIGINS_REGEX else [],
    allow_origin_regex=ALLOWED_ORIGINS_REGEX,  # takes effect if set
    allow_credentials=True,
    allow_methods=["*"], # for local/.dev "*", for prod allow_methods=["GET", "POST", "OPTIONS"]
    allow_headers=["*"], # for local/.dev "*", for prod allow_headers=["Content-Type", "Authorization", "x-bb-api-key"]
    max_age=600,
)


# Routes
app.include_router(runs.router, prefix="/v1", tags=["runs"])
app.include_router(sessions.router)
app.include_router(add_to_cart.router)

@app.get("/v1/health")
def health():
    return {"status": "ok"}
