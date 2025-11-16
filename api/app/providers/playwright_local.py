from typing import Any, Dict, List
from .base import BrowserProvider

class PlaywrightLocal(BrowserProvider):
    async def run(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Burcu-TODO: implement with Playwright
        return {"steps_executed": len(steps)}
