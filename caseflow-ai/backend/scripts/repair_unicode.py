"""Repair only known legacy-code-page damage; preserve an exact backup first.

Run from backend: python scripts/repair_unicode.py [--apply]
Unknown text is reported, never guessed or stripped of question marks.
"""
import argparse
import ast
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from sqlalchemy import String, inspect, text
from app.core.database import engine


def known_replacements():
    tree = ast.parse((ROOT / 'app/rules/decision_engine.py').read_text(encoding='utf-8'))
    roles = {node.value for node in ast.walk(tree)
             if isinstance(node, ast.Constant) and isinstance(node.value, str)
             and any(label in node.value for label in (
                 '(Ombudsman)', '(Chief Accountant)', '(Student Support Officer)',
                 '(Finance Officer)', '(Academic Officer)', '(Head of Academic Affairs)',
                 '(Department Head)'))}
    source = (ROOT.parent / 'frontend/src/pages/HumanReviewPage.tsx').read_text(encoding='utf-8')
    reviewer = re.search(r"reviewer_name:\s*'([^']+)'", source).group(1)
    summaries_tree = ast.parse((ROOT / 'app/services/case_analysis_service.py').read_text(encoding='utf-8'))
    summaries = set()
    for node in ast.walk(summaries_tree):
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'ESC_SUMMARY_VI' for target in node.targets):
            summaries.update(ast.literal_eval(node.value).values())
    upload_source = (ROOT.parent / 'frontend/src/pages/NewCasePage.tsx').read_text(encoding='utf-8')
    upload_description = re.search(r"uploadEvidence\(created.id, file, evType, '([^']+)'", upload_source).group(1)
    return {value.encode('cp1258', errors='replace').decode('cp1258'): value
            for value in roles | summaries | {reviewer, upload_description}}


def restore_known(value, replacements, embedded=False):
    if value in replacements:
        return replacements[value]
    if embedded:
        for damaged, original in replacements.items():
            if '?' in damaged:
                value = value.replace(damaged, original)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    replacements = known_replacements()
    changes = []
    unresolved = []
    repairable = {('Escalations', 'target_role'), ('HumanReviews', 'reviewer_role'),
                  ('HumanReviews', 'reviewer_name'), ('AuditLogs', 'actor_name'),
                  ('Escalations', 'evidence_summary'), ('Evidence', 'source_description')}
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table in inspector.get_table_names():
            columns = inspector.get_columns(table)
            if not any(column['name'] == 'id' for column in columns):
                continue
            for column in columns:
                if not isinstance(column['type'], String):
                    continue
                name = column['name']
                rows = connection.execute(text(
                    f'SELECT [id], [{name}] FROM [{table}] WHERE [{name}] LIKE :pattern'),
                    {'pattern': '%?%'}).all()
                for row_id, before in rows:
                    after = restore_known(before, replacements, table == 'AuditLogs') if (table, name) in repairable else before
                    if after != before:
                        changes.append(dict(table=table, column=name, id=row_id, before=before, after=after))
                    if re.search(r'\w\?\w|\?\w|\w\?(?=\s+\w)', after):
                        unresolved.append(dict(table=table, column=name, id=row_id))
        if args.apply and changes:
            backup_dir = ROOT / 'storage/unicode-backups'
            backup_dir.mkdir(parents=True, exist_ok=True)
            backup = backup_dir / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
            backup.write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding='utf-8')
            for change in changes:
                connection.execute(text(
                    f"UPDATE [{change['table']}] SET [{change['column']}] = :after "
                    f"WHERE [id] = :id AND [{change['column']}] = :before"), change)
            print(f'Backup: {backup}')
        print(json.dumps({'mode': 'apply' if args.apply else 'preview',
                          'known_repairs': len(changes), 'unresolved': unresolved}, ensure_ascii=False))


if __name__ == '__main__':
    main()
