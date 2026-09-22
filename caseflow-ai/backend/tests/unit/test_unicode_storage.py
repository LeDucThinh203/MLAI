"""Every user-visible content column must retain Vietnamese on SQL Server."""
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy.dialects import mssql
from app.db.base import Base
import app.models  # Register every mapped table.

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('unicode_migration', root / 'migrations/versions/0002_unicode_content.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


@pytest.mark.parametrize('table,column', [
    (table, column) for table, columns in migration.UNICODE_COLUMNS.items() for column in columns
])
def test_human_readable_columns_use_unicode(table, column):
    sql_type = str(Base.metadata.tables[table].c[column].type.compile(dialect=mssql.dialect()))
    assert sql_type.startswith(('NVARCHAR', 'NTEXT')), f'{table}.{column}: {sql_type}'


def test_known_repairs_preserve_unknown_text():
    spec = importlib.util.spec_from_file_location('unicode_repair', root / 'scripts/repair_unicode.py')
    repair = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(repair)
    original = 'Kế toán trưởng (Chief Accountant)'
    damaged = original.encode('cp1258', errors='replace').decode('cp1258')
    replacements = repair.known_replacements()
    assert repair.restore_known(damaged, replacements) == original
    assert repair.restore_known(f'Cán bộ ({damaged})', replacements, True) == f'Cán bộ ({original})'
    assert repair.restore_known('Bạn cần bổ sung gì?', replacements, True) == 'Bạn cần bổ sung gì?'
    assert repair.restore_known('Nguy?n không rõ', replacements) == 'Nguy?n không rõ'
