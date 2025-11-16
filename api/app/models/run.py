from typing import Any, Dict, Optional
from pydantic import BaseModel

class CreateRun(BaseModel):
    recipe: str
    params: Dict[str, Any] = {}

class Run(BaseModel):
    id: str
    recipe: str
    status: str
    result: Optional[Dict[str, Any]] = None
