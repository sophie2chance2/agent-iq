import os
import httpx
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])

BB_KEY = os.getenv("BROWSERBASE_API_KEY")
BB_PROJECT = os.getenv("BROWSERBASE_PROJECT_ID")
BB_URL = "https://www.browserbase.com/v1/sessions"

class AddToCartRequest(BaseModel):
    url: HttpUrl
    device_type: str | None = None           # "macos" or "windows" or "linux" etc
    advanced_stealth: bool = True
    proxies: list[str] | None = None
    experimental: dict | None = None

class SessionResponse(BaseModel):
    id: str | None = None
    status: str | None = None
    debug_url: str | None = None

def _normalize_os(device_type: str | None) -> str | None:
    if not device_type:
        return None
    d = device_type.strip().lower()
    if d in {"mac", "macos", "osx", "darwin"}:
        return "mac"
    if d in {"win", "windows"}:
        return "windows"
    if d in {"linux"}:
        return "linux"
    return None  # unknown -> omit

@router.post("/add-to-cart", response_model=SessionResponse)
async def create_add_to_cart_session(req: AddToCartRequest):
    if not BB_KEY:
        raise HTTPException(status_code=500, detail="Missing BROWSERBASE_API_KEY")

    # ---- normalize + enforce Browserbase policy ----
    norm_os = _normalize_os(req.device_type)

    # basic stealth => linux only; advanced => allow mac/windows/linux
    browser_settings = {"advancedStealth": req.advanced_stealth}
    if req.advanced_stealth:
        if norm_os:
            browser_settings["os"] = norm_os
    else:
        # force linux under basic stealth to avoid 400/“mac OS only for advanced stealth”
        browser_settings["os"] = "linux"

    payload = {
        "projectId": BB_PROJECT,
        "browserSettings": browser_settings,
    }
    if req.proxies:
        payload["proxies"] = req.proxies

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                BB_URL,
                json=payload,
                headers={
                    "content-type": "application/json",
                    "x-bb-api-key": BB_KEY,   # REQUIRED
                },
            )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"Browserbase {r.status_code}: {r.text}")
        data = r.json()
        return SessionResponse(
            id=data.get("id") or data.get("sessionId"),
            status=data.get("status"),
            debug_url=data.get("debuggerFullscreenUrl"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/{session_id}")
async def get_session(session_id: str = Path(..., description="Browserbase session id")):
    if not BB_KEY:
        raise HTTPException(500, "Missing BROWSERBASE_API_KEY")
    url = f"{BB_URL}/{session_id}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers={"x-bb-api-key": BB_KEY})
        if r.status_code != 200:
            raise HTTPException(502, f"Browserbase {r.status_code}: {r.text}")
        data = r.json()
        return {
            "id": data.get("id") or data.get("sessionId"),
            "status": data.get("status"),
            "debuggerFullscreenUrl": data.get("debuggerFullscreenUrl") or data.get("debuggerUrl"),
            "raw": data,  # optional: remove if you don’t want extra fields
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, str(e))
