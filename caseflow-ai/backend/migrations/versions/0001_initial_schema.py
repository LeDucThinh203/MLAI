"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-21 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mssql

revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Departments
    op.create_table(
        'Departments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_Departments_code', 'Departments', ['code'])

    # 2. Cases
    op.create_table(
        'Cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_code', sa.String(50), nullable=False, unique=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('student_identifier', sa.String(50), nullable=False),
        sa.Column('case_type', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, default='NEW'),
        sa.Column('current_department_id', sa.String(36), sa.ForeignKey('Departments.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_Cases_case_code', 'Cases', ['case_code'])
    op.create_index('ix_Cases_student_identifier', 'Cases', ['student_identifier'])
    op.create_index('ix_Cases_status', 'Cases', ['status'])

    # 3. CaseMessages
    op.create_table(
        'CaseMessages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('sender_type', sa.String(50), nullable=False),
        sa.Column('sender_name', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_CaseMessages_case_id', 'CaseMessages', ['case_id'])

    # 4. Evidence
    op.create_table(
        'Evidence',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('evidence_type', sa.String(50), nullable=False),
        sa.Column('original_file_name', sa.String(255), nullable=False),
        sa.Column('stored_file_name', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('sha256_hash', sa.String(64), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('source_description', sa.Text(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.Column('analysis_status', sa.String(50), nullable=False, default='PENDING'),
    )
    op.create_index('ix_Evidence_case_id', 'Evidence', ['case_id'])
    op.create_index('ix_Evidence_sha256_hash', 'Evidence', ['sha256_hash'])

    # 5. EvidenceExtractions
    op.create_table(
        'EvidenceExtractions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('evidence_id', sa.String(36), sa.ForeignKey('Evidence.id'), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('document_type', sa.String(100), nullable=False),
        sa.Column('structured_data_json', sa.Text().with_variant(mssql.NVARCHAR(None), 'mssql'), nullable=False),
        sa.Column('extraction_summary', sa.Text(), nullable=True),
        sa.Column('has_uncertain_fields', sa.Boolean(), nullable=False, default=False),
        sa.Column('uncertain_fields_json', sa.Text().with_variant(mssql.NVARCHAR(None), 'mssql'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_EvidenceExtractions_evidence_id', 'EvidenceExtractions', ['evidence_id'])

    # 6. EvidenceComparisons
    op.create_table(
        'EvidenceComparisons',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('left_evidence_id', sa.String(36), nullable=True),
        sa.Column('right_evidence_id', sa.String(36), nullable=True),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('left_value', sa.Text(), nullable=True),
        sa.Column('right_value', sa.Text(), nullable=True),
        sa.Column('comparison_status', sa.String(50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_EvidenceComparisons_case_id', 'EvidenceComparisons', ['case_id'])

    # 7. CaseDecisions
    op.create_table(
        'CaseDecisions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('decision_type', sa.String(50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('policy_reference', sa.String(200), nullable=True),
        sa.Column('evidence_summary', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_CaseDecisions_case_id', 'CaseDecisions', ['case_id'])

    # 8. Escalations
    op.create_table(
        'Escalations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('escalation_type', sa.String(50), nullable=False),
        sa.Column('target_department_id', sa.String(36), sa.ForeignKey('Departments.id'), nullable=True),
        sa.Column('target_role', sa.String(100), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('evidence_summary', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, default='PENDING'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_Escalations_case_id', 'Escalations', ['case_id'])

    # 9. HumanReviews
    op.create_table(
        'HumanReviews',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('reviewer_name', sa.String(100), nullable=False),
        sa.Column('reviewer_role', sa.String(100), nullable=False),
        sa.Column('decision', sa.String(50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_HumanReviews_case_id', 'HumanReviews', ['case_id'])

    # 10. AuditLogs
    op.create_table(
        'AuditLogs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('Cases.id'), nullable=False),
        sa.Column('actor_type', sa.String(50), nullable=False),
        sa.Column('actor_name', sa.String(100), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('input_snapshot', sa.Text().with_variant(mssql.NVARCHAR(None), 'mssql'), nullable=True),
        sa.Column('evidence_ids', sa.String(500), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('policy_reference', sa.String(200), nullable=True),
        sa.Column('result_snapshot', sa.Text().with_variant(mssql.NVARCHAR(None), 'mssql'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_AuditLogs_case_id', 'AuditLogs', ['case_id'])

    # 11. Policies
    op.create_table(
        'Policies',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('version', sa.String(20), nullable=False, default='1.0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_Policies_code', 'Policies', ['code'])

    # 12. PolicyRules
    op.create_table(
        'PolicyRules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('policy_id', sa.String(36), sa.ForeignKey('Policies.id'), nullable=False),
        sa.Column('rule_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('condition_type', sa.String(50), nullable=False),
        sa.Column('condition_value', sa.Text(), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, default=100),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_PolicyRules_policy_id', 'PolicyRules', ['policy_id'])
    op.create_index('ix_PolicyRules_rule_code', 'PolicyRules', ['rule_code'])

    # 13. VerificationRuns
    op.create_table(
        'VerificationRuns',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('run_code', sa.String(50), nullable=False, unique=True),
        sa.Column('status', sa.String(50), nullable=False, default='RUNNING'),
        sa.Column('total_cases', sa.Integer(), nullable=False, default=0),
        sa.Column('passed_cases', sa.Integer(), nullable=False, default=0),
        sa.Column('failed_cases', sa.Integer(), nullable=False, default=0),
        sa.Column('duration_ms', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_VerificationRuns_run_code', 'VerificationRuns', ['run_code'])

    # 14. VerificationResults
    op.create_table(
        'VerificationResults',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('run_id', sa.String(36), sa.ForeignKey('VerificationRuns.id'), nullable=False),
        sa.Column('case_identifier', sa.String(100), nullable=False),
        sa.Column('case_title', sa.String(255), nullable=False),
        sa.Column('expected_decision', sa.String(50), nullable=False),
        sa.Column('actual_decision', sa.String(50), nullable=False),
        sa.Column('expected_escalation', sa.String(50), nullable=True),
        sa.Column('actual_escalation', sa.String(50), nullable=True),
        sa.Column('is_passed', sa.Boolean(), nullable=False, default=False),
        sa.Column('duration_ms', sa.Integer(), nullable=False, default=0),
        sa.Column('details_json', sa.Text().with_variant(mssql.NVARCHAR(None), 'mssql'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_VerificationResults_run_id', 'VerificationResults', ['run_id'])


def downgrade() -> None:
    op.drop_table('VerificationResults')
    op.drop_table('VerificationRuns')
    op.drop_table('PolicyRules')
    op.drop_table('Policies')
    op.drop_table('AuditLogs')
    op.drop_table('HumanReviews')
    op.drop_table('Escalations')
    op.drop_table('CaseDecisions')
    op.drop_table('EvidenceComparisons')
    op.drop_table('EvidenceExtractions')
    op.drop_table('Evidence')
    op.drop_table('CaseMessages')
    op.drop_table('Cases')
    op.drop_table('Departments')
