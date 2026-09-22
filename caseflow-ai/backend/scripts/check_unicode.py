"""Read-only project scan and SQL Server Unicode round trip in a temporary table.

Run from backend: python scripts/check_unicode.py
"""
import importlib.util
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from sqlalchemy import inspect, text
from app.core.database import engine


def main():
    failures = []
    count = 0
    excluded = {'.git', '.venv', 'venv', 'node_modules', 'dist', '__pycache__', '.pytest_cache', 'unicode-backups'}
    suffixes = {'.py', '.tsx', '.ts', '.js', '.css', '.html', '.json', '.md', '.toml', '.yml', '.bat'}
    for path in ROOT.parent.rglob('*'):
        if excluded.intersection(path.parts) or path.suffix not in suffixes or not path.is_file():
            continue
        try:
            source = path.read_text(encoding='utf-8-sig')
            count += 1
            if '\ufffd' in source or re.search(r'[\u00e1][\u00ba\u00bb]|[\u00c3][\u0080-\u00bf]', source):
                failures.append(str(path.relative_to(ROOT.parent)))
        except UnicodeDecodeError:
            failures.append(str(path.relative_to(ROOT.parent)))
    print(f'Scanned {count} project text files; invalid UTF-8 / damaged encoding: {len(failures)}')
    spec = importlib.util.spec_from_file_location('migration', ROOT / 'migrations/versions/0002_unicode_content.py')
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    sample = 'Tiếng Việt: Nguyễn, Trưởng phòng, kế toán, chứng từ, ắ ằ ẵ ặ ớ ờ ỡ ợ ứ ừ ữ ự Đ đ'
    verified = 0
    with engine.connect() as connection:
        inspector = inspect(connection)
        for table, columns in migration.UNICODE_COLUMNS.items():
            actual = {column['name']: column for column in inspector.get_columns(table)}
            for name in columns:
                sql_type = actual[name]['type'].compile(dialect=engine.dialect)
                if not sql_type.upper().startswith(('NVARCHAR', 'NTEXT')):
                    failures.append(f'{table}.{name}: {sql_type}')
                    continue
                connection.execute(text(f'CREATE TABLE #UnicodeProbe ([value] {sql_type})'))
                connection.execute(text('INSERT INTO #UnicodeProbe ([value]) VALUES (:value)'), {'value': sample})
                result = connection.execute(text('SELECT [value] FROM #UnicodeProbe')).scalar_one()
                connection.execute(text('DROP TABLE #UnicodeProbe'))
                if result != sample:
                    failures.append(f'{table}.{name}: round trip mismatch')
                verified += 1
        connection.rollback()
    print(f'Unicode database column round trips: {verified}')
    if failures:
        print('\n'.join(failures))
        raise SystemExit(1)
    print('PASS')


if __name__ == '__main__':
    main()
