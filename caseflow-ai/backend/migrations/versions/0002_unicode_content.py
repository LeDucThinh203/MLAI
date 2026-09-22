"""Preserve Vietnamese in all human-readable content, including existing installs."""
from alembic import op
import sqlalchemy as sa

revision = '0002_unicode_content'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None

# Explicit list: identifiers and enum codes remain unchanged. None means MAX.
UNICODE_COLUMNS = {
    'Departments': {'name': 200, 'description': None},
    'Cases': {'title': 255, 'description': None},
    'CaseMessages': {'sender_name': 100, 'message': None},
    'Evidence': {'original_file_name': 255, 'stored_file_name': 255,
                 'storage_path': 500, 'source_description': None},
    'EvidenceExtractions': {'document_type': 100, 'structured_data_json': None,
                           'extraction_summary': None, 'uncertain_fields_json': None},
    'EvidenceComparisons': {'left_value': None, 'right_value': None, 'reason': None},
    'CaseDecisions': {'reason': None, 'policy_reference': 200, 'evidence_summary': None},
    'Escalations': {'target_role': 100, 'question': None, 'reason': None, 'evidence_summary': None},
    'HumanReviews': {'reviewer_name': 100, 'reviewer_role': 100, 'reason': None},
    'AuditLogs': {'actor_name': 100, 'action': 100, 'input_snapshot': None,
                  'reason': None, 'policy_reference': 200, 'result_snapshot': None},
    'Policies': {'name': 200, 'description': None},
    'PolicyRules': {'name': 200, 'description': None, 'condition_value': None},
    'VerificationResults': {'case_title': 255, 'details_json': None},
}


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    for table, fields in UNICODE_COLUMNS.items():
        existing = {column['name']: column for column in inspector.get_columns(table)}
        for name, length in fields.items():
            column = existing[name]
            # Respect nullable values and support databases partly fixed by hand.
            op.alter_column(table, name, type_=sa.Unicode(length),
                            existing_type=column['type'], existing_nullable=column['nullable'])


def downgrade():
    raise RuntimeError('Unicode content cannot be safely downgraded to a legacy code page.')
