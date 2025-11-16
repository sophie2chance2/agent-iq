from typing import Optional, Any, Dict, List, Literal
from pydantic import BaseModel, AnyUrl

# ----- Requests / Responses -----

class CreateSessionRequest(BaseModel):
    url: AnyUrl 


class CreateSessionResponse(BaseModel):
    sessionId: str
    sessionUrl: AnyUrl
    debuggerFullscreenUrl: AnyUrl
    debuggerUrl: AnyUrl
    wsUrl: AnyUrl

class RunRequest(BaseModel):
    task_type: str
    prompt: Optional[str] = None
    url: AnyUrl
    model: str
    env: str
    stealth: Literal["none", "basic", "aggressive"]
    proxies: Optional[Dict[str, Any]] = None

class RunResponse(BaseModel):
    run_id: str
    session_live_view_url: AnyUrl
    session_id: str

class EvaluationDetailsRequest(BaseModel):
    task_id: str
    task_description: str
    final_result_response: Optional[str] = None
    action_history: Optional[List[str]] = None
    thoughts: Optional[List[str]] = None
    screenshots: List[str]  # base64-encoded images
    input_image_paths: Optional[List[str]] = None  # optional reference images
    
class EvaluationDetailsResponse(BaseModel):
    image_judge_record: List[Dict[str, Any]]
    key_points: str
    input_text: str
    system_msg: str
    evaluation_details: Dict[str, Any]
    predicted_label: int
    

class RobotsAnalysisRequest(BaseModel):
    url: AnyUrl

class AIRules(BaseModel):
    disallowed_agents: List[str] = []
    allowed_agents: List[str] = []
    disallowed_paths: List[str] = []
    allowed_paths: List[str] = []
    general_access: Literal["unknown", "restricted", "allowed", "mixed"] = "unknown"

class RobotsAnalysisResponse(BaseModel):
    has_robots_txt: bool
    robots_url: Optional[str] = None
    robots_content: Optional[str] = None
    ai_rules: Optional[AIRules] = None
    llm_suggestions: Optional[str] = None
    error: Optional[str] = None
