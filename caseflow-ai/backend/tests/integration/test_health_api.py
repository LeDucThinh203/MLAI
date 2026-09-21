import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db

client = TestClient(app)

def test_health_check_endpoint():
    # Mock database session to return 1
    class DummyDB:
        def execute(self, query):
            return 1

    app.dependency_overrides[get_db] = lambda: DummyDB()
    
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["api"] == "healthy"
    assert data["services"]["database"] == "healthy"

    app.dependency_overrides.clear()
