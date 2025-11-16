import os, json, asyncio
from typing import Any, Dict, List
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/v1/add-to-cart", tags=["add-to-cart"])

BB_KEY = os.getenv("BROWSERBASE_API_KEY")
BB_PROJECT = os.getenv("BROWSERBASE_PROJECT_ID")
BB_SESSIONS = "https://www.browserbase.com/v1/sessions"

# ----- Request/Response models (superset of UI expectations) -----
class Params(BaseModel):
    modelName: str | None = "openai/gpt-4o-mini"
    advancedStealth: bool | None = False
    proxies: Any | None = False
    experimental: Any | None = False
    environment: str | None = "BROWSERBASE"
    deviceType: str | None = "mac"   # UI sends "mac"

class AddToCartExecuteRequest(BaseModel):
    url: HttpUrl
    searchTerm: str
    parameters: Params | List[Params] | None = None

def _sse(data: Dict[str, Any]) -> bytes:
    return f"data: {json.dumps(data)}\n\n".encode("utf-8")

async def _create_browserbase_session(
    client: httpx.AsyncClient, p: Params
) -> Dict[str, Any]:
    if not BB_KEY:
        raise HTTPException(500, "Missing BROWSERBASE_API_KEY")

    payload = {
        "projectId": BB_PROJECT,
        "browserSettings": {
            "advancedStealth": bool(p.advancedStealth),
            **({"os": p.deviceType} if p.deviceType else {}),
        },
    }
    r = await client.post(
        BB_SESSIONS,
        json=payload,
        headers={"content-type": "application/json", "x-bb-api-key": BB_KEY},
        timeout=20,
    )
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"Browserbase {r.status_code}: {r.text}")
    return r.json()

@router.post("/execute")
async def add_to_cart_execute(req: AddToCartExecuteRequest, request: Request):
    """
    SSE endpoint that mirrors the Next.js route:
    - emits {"status":"started"}
    - may emit {"debuggerUrl": "..."}
    - emits {"status":"completed", "results":[ ... ]}
    """
    # normalize parameters -> List[Params]
    if isinstance(req.parameters, list):
        params_list = [Params(**(p if isinstance(p, dict) else p.model_dump())) for p in req.parameters]
    elif isinstance(req.parameters, dict):
        params_list = [Params(**req.parameters)]
    elif isinstance(req.parameters, Params):
        params_list = [req.parameters]
    else:
        params_list = [Params()]  # default one run

    async def event_stream():
        # start
        yield _sse({"status": "started"})

        results = []
        try:
            async with httpx.AsyncClient() as client:
                # run each param set in "parallel" (sequential here for simplicity)
                for p in params_list:
                    # Create Browserbase session
                    data = await _create_browserbase_session(client, p)
                    session_id = data.get("id") or data.get("sessionId")
                    debugger_url = data.get("debuggerFullscreenUrl") or data.get("debuggerUrl")

                    # emit debugger URL early (UI listens for this)
                    if debugger_url:
                        yield _sse({"debuggerUrl": debugger_url})

                    # TODO: hook Sophie’s Stagehand v3 "add-to-cart" script here.
                    # For now, stub a small delay and fake result so UI can proceed.
                    await asyncio.sleep(0.5)

                    # Simulated result shape the UI expects
                    metrics = data.get("metrics") or None
                    aggregate = data.get("aggregateMetrics") or None
                    screenshots = None  # plug real screenshots later

                    result_item = {
                        "metrics": metrics,
                        "aggregateMetrics": aggregate,
                        "screenshots": screenshots,
                        "extractionResults": {
                            "success": True,
                            "cartCount": 1
                        },
                        "params": {
                            "modelName": p.modelName,
                            "advancedStealth": p.advancedStealth,
                            "proxies": p.proxies,
                            "experimental": p.experimental,
                            "environment": p.environment,
                            "deviceType": p.deviceType,
                        }
                    }
                    results.append(result_item)

            # final completion
            yield _sse({"status": "completed", "results": results})

        except HTTPException as he:
            yield _sse({"error": str(he.detail)})
        except Exception as e:
            yield _sse({"error": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
