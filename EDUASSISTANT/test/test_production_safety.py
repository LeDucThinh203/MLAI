"""Production defaults for demo fixtures and account creation."""

import asyncio

import pytest

from app.config import _seed_demo_data_enabled
from app.db.db import DatabaseService


def test_demo_seeding_defaults_off_in_production_and_is_explicitly_overridable():
    assert not _seed_demo_data_enabled('production')
    assert not _seed_demo_data_enabled('test')
    assert _seed_demo_data_enabled('development')
    assert _seed_demo_data_enabled('demo')
    assert _seed_demo_data_enabled('production', 'true')
    assert not _seed_demo_data_enabled('development', 'false')


def test_user_creation_requires_an_explicit_password():
    with pytest.raises(ValueError, match='password is required'):
        asyncio.run(DatabaseService.create_user({'username': 'new-user', 'fullName': 'New User'}))
