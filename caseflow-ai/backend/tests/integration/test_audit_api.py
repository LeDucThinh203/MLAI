def test_audit_module_imports():
    from app.api.routes import audit_logs
    assert audit_logs is not None
