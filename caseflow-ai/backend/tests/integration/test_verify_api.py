def test_verify_module_imports():
    from app.api.routes import verify
    assert verify is not None
