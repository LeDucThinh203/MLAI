import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_docs_available():
    response = client.get("/docs")
    assert response.status_code == 200

def test_openapi_json():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "paths" in data
    assert "/api/cases" in data["paths"]
    assert "/api/verify/run" in data["paths"]
