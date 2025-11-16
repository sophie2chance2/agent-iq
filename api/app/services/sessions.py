import os
import requests
from fastapi import HTTPException

def create_browser_session(url: str) -> dict:
    BB_API_KEY = os.getenv("BROWSERBASE_API_KEY")
    BB_PROJECT_ID = os.getenv("BROWSERBASE_PROJECT_ID")

    if not BB_API_KEY or not BB_PROJECT_ID:
        raise HTTPException(status_code=500, detail="Browserbase API key or project ID not set")

    # Step 1: Create session
    try:
        create_resp = requests.post(
            "https://www.browserbase.com/v1/sessions",
            headers={"Content-Type": "application/json", "X-BB-API-Key": BB_API_KEY},
            json={
                "projectId": BB_PROJECT_ID,
                "browserSettings": {"viewport": {"width": 1280, "height": 720}},
                "proxies": False
            },
            timeout=10
        )
        create_resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to create browser session: {e}")

    session_data = create_resp.json()
    session_id = session_data.get("id")
    session_url = session_data.get("sessionUrl")

    # Step 2: Get debug URLs
    try:
        debug_resp = requests.get(
            f"https://www.browserbase.com/v1/sessions/{session_id}/debug",
            headers={"X-BB-API-Key": BB_API_KEY},
            timeout=10
        )
        debug_resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session debug URLs: {e}")

    debug_data = debug_resp.json()

    return {
        "sessionId": session_id,
        "sessionUrl": session_url,
        "debuggerFullscreenUrl": debug_data.get("debuggerFullscreenUrl"),
        "debuggerUrl": debug_data.get("debuggerUrl"),
        "wsUrl": debug_data.get("wsUrl")
    }
