from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class Variant(BaseModel):
    perception: Optional[str] = "dom"           # dom|vision
    runtime: Optional[str] = "playwright_local" # playwright_local|browser_provider
    
class CreateSessionRequest(BaseModel):
    url: str

class CreateSessionResponse(BaseModel):
    sessionId: str
    sessionUrl: str
    debuggerFullscreenUrl: str
    debuggerUrl: str
    wsUrl: str

class RunRequest(BaseModel):
    site: str
    task_id: str
    variant: Variant
    payload: Optional[Dict[str, Any]] = None

class RunResponse(BaseModel):
    run_id: str
    status: str

class RunSummary(BaseModel):
    run_id: str
    site: str
    task_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    links: Dict[str, str] = {}

class RunEvent(BaseModel):
    ts: str
    step: str
    action: str
    status: str
    details: Dict[str, Any] = {}

class Artifact(BaseModel):
    kind: str
    url: str

class Score(BaseModel):
    success: bool
    time_to_success_ms: Optional[int] = None
    fail_reason: Optional[str] = None
    metrics: Dict[str, float] = {}
    artifacts: List[Artifact] = []
