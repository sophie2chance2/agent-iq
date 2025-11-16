# w210-fall25-agent-nav-sim
Capstone Project Fall '25 - Agent Navigability Simulator
# Agent Navigability Simulator API

Versioned base path: **`/v1`**
OpenAPI spec: **`/v1/openapi.json`**
Health: **`GET /v1/health`**

> This README summarizes the endpoints defined in the latest `openapi.yaml` and the current FastAPI layout. Examples assume a local dev server at `http://127.0.0.1:8000`.

---

## Auth & Headers

Endpoints accept/produce JSON.

\`\`\`http
Content-Type: application/json
Accept: application/json
\`\`\`

If authentication is enabled, include your scheme as appropriate (example: Bearer token):

\`\`\`http
Authorization: Bearer <token>

\`\`\`

---

## Common Error Shape

\`\`\`json
{
  "error": "NotFound",
  "message": "Run not found",
  "details": { }
}
\`\`\`

`error` is a short machine string; `message` is human‑readable; `details` (optional) may include field‑level info.

---

## Runs

### POST `/v1/runs`

Create a new run for a given site/task/recipe configuration. Enqueues the job and returns its identifier.

**Request – `RunRequest` (example)**

\`\`\`json
{
  "site": "https://example.com",
  "task": "login-and-fetch-dashboard",
  "recipe_id": "portfolio/vision+dom-v1",
  "variant": {
    "model": "gpt-4o-mini",
    "stealth_level": "medium",
    "control_mode": "vision",
    "navigation": "cursor+dom"
  },
  "inputs": {
    "username": "demo@example.com",
    "password_secret_name": "demo_pwd"
  },
  "metadata": {
    "requested_by": "burcu",
    "notes": "pilot run"
  }
}
\`\`\`

**Response – `RunResponse` (example)**

\`\`\`json
{
  "run_id": "run_01HZXE7VYQ9PAX",
  "status": "queued"
}
\`\`\`

**Status codes**

* `201 Created` on success
* `400 Bad Request` on validation error

**cURL**

\`\`\`bash
curl -sS -X POST http://127.0.0.1:8000/v1/runs \
  -H 'Content-Type: application/json' \
  -d @run_request.json
\`\`\`

---

### GET `/v1/runs/{id}`

Fetch a **Run Summary** including high‑level fields, timestamps, and quick stats.

**Response – `RunSummary` (example)**

\`\`\`json
{
  "run_id": "run_01HZXE7VYQ9PAX",
  "status": "running",
  "site": "https://example.com",
  "task": "login-and-fetch-dashboard",
  "recipe_id": "portfolio/vision+dom-v1",
  "created_at": "2025-10-02T18:30:12Z",
  "started_at": "2025-10-02T18:30:35Z",
  "ended_at": null,
  "attempt": 1,
  "agent": {
    "name": "navigator-vision",
    "version": "1.2.0"
  },
  "quick_stats": {
    "steps": 7,
    "success": false
  }
}
\`\`\`

**Status codes**

* `200 OK` on success
* `404 Not Found` if run does not exist

**cURL**

\`\`\`bash
curl -sS http://127.0.0.1:8000/v1/runs/run_01HZXE7VYQ9PAX
\`\`\`

---

### GET `/v1/runs/{id}/status`

Lightweight polling endpoint for the current run state.

**Response – `AgentStatus` (example)**

\`\`\`json
{
  "run_id": "run_01HZXE7VYQ9PAX",
  "status": "running",
  "progress": 0.55,
  "last_event_ts": "2025-10-02T18:31:42Z"
}
\`\`\`

**Status codes**

* `200 OK` on success
* `404 Not Found` if run does not exist

**cURL**

\`\`\`bash
curl -sS http://127.0.0.1:8000/v1/runs/run_01HZXE7VYQ9PAX/status
\`\`\`

---

### GET `/v1/runs/{id}/score`

Final (or interim) scoring for the run.

**Response – `ScoreDetail` (example)**

\`\`\`json
{
  "run_id": "run_01HZXE7VYQ9PAX",
  "overall": 0.78,
  "components": {
    "task_success": 1.0,
    "time_efficiency": 0.72,
    "interaction_cost": 0.64,
    "fragility": 0.65
  },
  "notes": "Completed with a manual CAPTCHA bypass flag."
}
\`\`\`

**Status codes**

* `200 OK` on success
* `409 Conflict` if scoring not yet available (run not finished)
* `404 Not Found` if run does not exist

**cURL**

\`\`\`bash
curl -sS http://127.0.0.1:8000/v1/runs/run_01HZXE7VYQ9PAX/score
\`\`\`

---

### GET `/v1/runs/{id}/execution_details`

Rich execution trace, including ordered events and artifacts.

**Response – `ExecutionDetails` (example)**

\`\`\`json
{
  "run_id": "run_01HZXE7VYQ9PAX",
  "events": [
    {
      "ts": "2025-10-02T18:30:36Z",
      "type": "nav.navigate",
      "message": "open https://example.com/login",
      "step": 1
    },
    {
      "ts": "2025-10-02T18:30:49Z",
      "type": "dom.fill",
      "message": "#username, #password",
      "step": 3
    },
    {
      "ts": "2025-10-02T18:31:15Z",
      "type": "artifact.saved",
      "message": "screenshot://run_01HZX.../step3.png"
    }
  ],
  "artifacts": [
    {
      "kind": "screenshot",
      "path": "s3://ans-artifacts/run_01HZX.../step3.png"
    }
  ]
}
\`\`\`

**Status codes**

* `200 OK` on success
* `404 Not Found` if run does not exist

**cURL**

\`\`\`bash
curl -sS http://127.0.0.1:8000/v1/runs/run_01HZXE7VYQ9PAX/execution_details
\`\`\`

---

## Robots & Site Checks

### POST `/v1/robots/analyze`

Analyze a site’s `robots.txt` and related signals (sitemaps, rate limits, disallow rules) to inform recipe selection and pacing.

**Request – `RobotsAnalysisRequest` (example)**

\`\`\`json
{
  "site": "https://example.com",
  "user_agent": "ANSBot/1.0"
}
\`\`\`

**Response – `RobotsAnalysisResponse` (example)**

\`\`\`json
{
  "site": "https://example.com",
  "robots_url": "https://example.com/robots.txt",
  "fetched_at": "2025-10-02T18:12:01Z",
  "rules": {
    "disallow": ["/admin", "/private"],
    "allow": ["/", "/dashboard"],
    "crawl_delay_seconds": 5
  },
  "sitemaps": [
    "https://example.com/sitemap.xml"
  ],
  "notes": "Crawl-delay present; throttle navigation and downloads."
}
\`\`\`

**Status codes**

* `200 OK` on success
* `400 Bad Request` on invalid input
* `424 Failed Dependency` if fetch fails upstream

**cURL**

\`\`\`bash
curl -sS -X POST http://127.0.0.1:8000/v1/robots/analyze \
  -H 'Content-Type: application/json' \
  -d '{"site":"https://example.com","user_agent":"ANSBot/1.0"}'
\`\`\`

---

## Models (Schema)

> Canonical definitions live in `openapi.yaml`.
> Below is a summary of key objects:

**RunRequest**

* `site` (string, URL)
* `task` (string)
* `recipe_id` (string)
* `variant` (object): `{ model, stealth_level, control_mode, navigation }`
* `inputs` (object, optional): credential selectors, form fields, etc.
* `metadata` (object, optional)

**RunResponse**

* `run_id` (string)
* `status` (enum): queued | running | completed | failed | cancelled

**RunSummary**

* `run_id`, `status`, `site`, `task`, `recipe_id`
* `created_at`, `started_at`, `ended_at` (ISO-8601)
* `attempt` (int)
* `agent` (object): `{ name, version }`
* `quick_stats` (object): `{ steps, success }`

**AgentStatus**

* `run_id` (string)
* `status` (enum)
* `progress` (0..1, optional)
* `last_event_ts` (ISO-8601, optional)

**ScoreDetail**

* `run_id` (string)
* `overall` (0..1)
* `components` (object): `{ task_success, time_efficiency, interaction_cost, fragility }`
* `notes` (string, optional)

**ExecutionDetails**

* `run_id` (string)
* `events` (array of `RunEvent`)
* `artifacts` (array)

**RunEvent**

* `ts` (ISO-8601)
* `type` (string, e.g., `nav.navigate`, `dom.fill`, `artifact.saved`)
* `message` (string)
* `step` (int, optional)

**RobotsAnalysisRequest**

* `site` (string, URL)
* `user_agent` (string, optional)

**RobotsAnalysisResponse**

* `site` (string)
* `robots_url` (string)
* `fetched_at` (ISO-8601)
* `rules` (object): `{ allow[], disallow[], crawl_delay_seconds }`
* `sitemaps` (string[])
* `notes` (string, optional)

---

## Conventions

* **Versioning**: All endpoints are namespaced under `/v1` to allow non‑breaking evolution.
* **Idempotency**: `POST /runs` should be treated as create‑and‑enqueue; provide your own external id if idempotency is needed.
* **Timestamps**: ISO‑8601 in UTC.
* **Artifacts**: Artifact locations are opaque URIs; the server may return signed URLs or storage keys depending on deployment.

---

## Local Quick Start

\`\`\`bash
# Health
curl -i http://127.0.0.1:8000/v1/health

# Create run
curl -sS -X POST http://127.0.0.1:8000/v1/runs \
  -H 'Content-Type: application/json' \
  -d '{
        "site":"https://example.com",
        "task":"login-and-fetch-dashboard",
        "recipe_id":"portfolio/vision+dom-v1"
      }' | jq

# Poll status
curl -sS http://127.0.0.1:8000/v1/runs/<RUN_ID>/status | jq

# Fetch score
curl -sS http://127.0.0.1:8000/v1/runs/<RUN_ID>/score | jq

# Execution details
curl -sS http://127.0.0.1:8000/v1/runs/<RUN_ID>/execution_details | jq

# Robots analysis
curl -sS -X POST http://127.0.0.1:8000/v1/robots/analyze \
  -H 'Content-Type: application/json' \
  -d '{"site":"https://example.com"}' | jq
\`\`\`

---

## Changelog:

* **2025‑10‑02**: Adopted **Option A** routing; added `/v1/robots/analyze`; clarified `ScoreDetail.components`; added `quick_stats` to `RunSummary`.
* **2025‑10‑05**: README synced to latest `openapi.yaml`; unified error shape and added example payloads.
