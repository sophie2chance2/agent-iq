from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get("/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_create_run():
    payload = {
        "site": "target",
        "task_id": "ecommerce.add_white_tshirt_to_cart.v1",
        "variant": {"perception": "dom", "runtime": "playwright_local"},
    }
    r = client.post("/v1/runs", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert "run_id" in body and "status" in body

def test_get_run_and_score():
    # use the known demo id
    r = client.get("/v1/runs/run_demo_1")
    assert r.status_code == 200
    body = r.json()
    assert body["run_id"] == "run_demo_1"
    assert "links" in body and "score" in body["links"]

    r2 = client.get("/v1/runs/run_demo_1/score")
    assert r2.status_code == 200
    score = r2.json()
    assert "success" in score and "metrics" in score

def test_list_events():
    r = client.get("/v1/runs/run_demo_1/events")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
