from abc import ABC, abstractmethod
from typing import Any, Dict, List

class BrowserProvider(ABC):
    @abstractmethod
    async def run(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        ...
