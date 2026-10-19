CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(100) PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
 fullname VARCHAR(255) NOT NULL, studentcode VARCHAR(100), email VARCHAR(255), role VARCHAR(50) NOT NULL,
 department VARCHAR(255), avatar TEXT, bio TEXT, twofactorenabled BOOLEAN NOT NULL DEFAULT FALSE,
 twofactorsecret VARCHAR(255), mustchangepassword BOOLEAN NOT NULL DEFAULT FALSE,
 academicstatus VARCHAR(50) DEFAULT 'ACTIVE', coursestartdate VARCHAR(50), courseenddate VARCHAR(50),
 currenttermactive BOOLEAN DEFAULT TRUE, hascurrentschedule BOOLEAN DEFAULT TRUE,
 registeredpermanentaddress TEXT, faculty VARCHAR(255), createdat VARCHAR(100), updatedat VARCHAR(100)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountsource VARCHAR(50) NOT NULL DEFAULT 'STANDARD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountbatchid VARCHAR(100);
CREATE TABLE IF NOT EXISTS account_generation_jobs (
 id VARCHAR(100) PRIMARY KEY, createdby VARCHAR(100) NOT NULL, status VARCHAR(30) NOT NULL,
 total INTEGER NOT NULL, generated INTEGER NOT NULL DEFAULT 0, error TEXT, credentialseed TEXT,
 createdat VARCHAR(100) NOT NULL, updatedat VARCHAR(100) NOT NULL
);
ALTER TABLE account_generation_jobs ADD COLUMN IF NOT EXISTS credentialseed TEXT;
CREATE TABLE IF NOT EXISTS cases (
 id VARCHAR(100) PRIMARY KEY, studentid VARCHAR(100) NOT NULL REFERENCES users(id), studentname VARCHAR(255) NOT NULL,
 studentcode VARCHAR(100), title VARCHAR(500) NOT NULL, category VARCHAR(100) NOT NULL, priority VARCHAR(50) DEFAULT 'MEDIUM',
 description TEXT, status VARCHAR(50) NOT NULL, reviewresult TEXT, supplementhistory TEXT, aiextraction TEXT,
 evidencefiles TEXT, deadline VARCHAR(100), assigneddepartment VARCHAR(255), digitalsignature TEXT,
 reviewerfeedback TEXT, studentclaim TEXT, institutionalfacts TEXT, addressanalysis TEXT,
 createdat VARCHAR(100), updatedat VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS audits (
 id VARCHAR(100) PRIMARY KEY, action VARCHAR(100) NOT NULL, caseid VARCHAR(100), actorid VARCHAR(100),
 actorname VARCHAR(255), actorrole VARCHAR(50), actorusername VARCHAR(100), inputdata TEXT, result TEXT,
 reason TEXT, timestamp VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS comments (
 id VARCHAR(100) PRIMARY KEY, caseid VARCHAR(100) NOT NULL REFERENCES cases(id), authorid VARCHAR(100) NOT NULL,
 authorname VARCHAR(255) NOT NULL, authorrole VARCHAR(50) NOT NULL, authoravatar TEXT, content TEXT NOT NULL,
 createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
 id VARCHAR(100) PRIMARY KEY, userid VARCHAR(100) NOT NULL REFERENCES users(id), title VARCHAR(255) NOT NULL,
 message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'INFO', caseid VARCHAR(100), isread BOOLEAN NOT NULL DEFAULT FALSE,
 createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
 id VARCHAR(100) PRIMARY KEY, userid VARCHAR(100) NOT NULL REFERENCES users(id), token VARCHAR(255) UNIQUE NOT NULL,
 expiresat VARCHAR(100) NOT NULL, createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS revoked_access_tokens (
 jti VARCHAR(100) PRIMARY KEY, expiresat VARCHAR(100) NOT NULL, createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_uploads (
 filename VARCHAR(255) PRIMARY KEY, ownerid VARCHAR(100) NOT NULL REFERENCES users(id), metadata TEXT NOT NULL,
 ocrdata TEXT, ocrprovider VARCHAR(100), ocrislive BOOLEAN NOT NULL DEFAULT FALSE, createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS escalation_policy_state (
 id VARCHAR(100) PRIMARY KEY, currentthreshold DOUBLE PRECISION NOT NULL, minthreshold DOUBLE PRECISION NOT NULL,
 maxthreshold DOUBLE PRECISION NOT NULL, stepsize DOUBLE PRECISION NOT NULL, updatedat VARCHAR(100) NOT NULL,
 updatedby VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS escalation_threshold_history (
 id VARCHAR(100) PRIMARY KEY, caseid VARCHAR(100), feedbacktype VARCHAR(50) NOT NULL,
 oldthreshold DOUBLE PRECISION NOT NULL, newthreshold DOUBLE PRECISION NOT NULL, reviewerid VARCHAR(100),
 reviewername VARCHAR(255), note TEXT, createdat VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS sis_student_records (
 id VARCHAR(100) PRIMARY KEY, userid VARCHAR(100) UNIQUE NOT NULL REFERENCES users(id), studentcode VARCHAR(100) UNIQUE,
 fullname VARCHAR(255) NOT NULL, academicstatus VARCHAR(50), coursestartdate VARCHAR(50), courseenddate VARCHAR(50),
 currenttermactive BOOLEAN, hascurrentschedule BOOLEAN, registeredpermanentaddress TEXT, faculty VARCHAR(255),
 source VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_SIS_DEMO', sourcetype VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_DEMO_SIS',
 verificationstatus VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED', verifiedby VARCHAR(100), verifiedat VARCHAR(100),
 recordstatus VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', createdat VARCHAR(100) NOT NULL, updatedat VARCHAR(100) NOT NULL,
 updatedby VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS agent_conversations (
 id VARCHAR(100) PRIMARY KEY, user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(255) NOT NULL, created_at VARCHAR(100) NOT NULL, updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_messages (
 id VARCHAR(100) PRIMARY KEY, conversation_id VARCHAR(100) NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
 user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE, role VARCHAR(30) NOT NULL,
 content TEXT NOT NULL, metadata TEXT, created_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_pending_actions (
 id VARCHAR(100) PRIMARY KEY, user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 conversation_id VARCHAR(100) NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
 tool_name VARCHAR(100) NOT NULL, arguments TEXT NOT NULL, arguments_hash VARCHAR(64) NOT NULL,
 preview TEXT NOT NULL, role_at_request VARCHAR(50) NOT NULL, status VARCHAR(30) NOT NULL,
 expires_at VARCHAR(100) NOT NULL, created_at VARCHAR(100) NOT NULL, updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_documents (
 id VARCHAR(200) PRIMARY KEY, source_key VARCHAR(200) NOT NULL, source_path VARCHAR(500) NOT NULL,
 title VARCHAR(255) NOT NULL, source_type VARCHAR(100) NOT NULL, priority DOUBLE PRECISION NOT NULL,
 version VARCHAR(100) NOT NULL, content_hash VARCHAR(64) NOT NULL, updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_chunks (
 id VARCHAR(200) PRIMARY KEY, document_id VARCHAR(200) NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
 source_key VARCHAR(200) NOT NULL, source_path VARCHAR(500) NOT NULL, title VARCHAR(255) NOT NULL,
 heading VARCHAR(500) NOT NULL, source_type VARCHAR(100) NOT NULL, priority DOUBLE PRECISION NOT NULL,
 version VARCHAR(100) NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, embedding TEXT,
 embedding_provider VARCHAR(100), embedding_model VARCHAR(200), embedding_dimension INTEGER, created_at VARCHAR(100) NOT NULL
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS academicstatus VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS coursestartdate VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS courseenddate VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS currenttermactive BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hascurrentschedule BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registeredpermanentaddress TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty VARCHAR(255);
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS source VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_SIS_DEMO';
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS sourcetype VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_DEMO_SIS';
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verificationstatus VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verifiedby VARCHAR(100);
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verifiedat VARCHAR(100);
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS recordstatus VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS updatedby VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_action_timestamp ON audits (action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_role_timestamp ON audits (actorrole, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_case_timestamp ON audits (caseid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_actor_timestamp ON audits (actorid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases (createdat DESC);
CREATE INDEX IF NOT EXISTS idx_cases_student_created ON cases (studentid, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases (status, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_cases_category_created ON cases (category, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_cases_department_created ON cases (assigneddepartment, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (createdat DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at_id ON users (createdat DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_users_role_created ON users (role, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_username_prefix ON users (LOWER(username) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_fullname_prefix ON users (LOWER(fullname) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_studentcode_prefix ON users (LOWER(COALESCE(studentcode,'')) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_department_prefix ON users (LOWER(COALESCE(department,'')) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_role_prefix ON users (LOWER(role) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_account_batch ON users (accountbatchid) WHERE accountbatchid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_case_created ON comments (caseid, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (userid, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (userid, isread);
CREATE INDEX IF NOT EXISTS idx_evidence_owner_created ON evidence_uploads (ownerid, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expiry ON refresh_tokens (userid, expiresat);
CREATE INDEX IF NOT EXISTS idx_revoked_access_tokens_expiry ON revoked_access_tokens (expiresat);
CREATE INDEX IF NOT EXISTS idx_threshold_history_created ON escalation_threshold_history (createdat DESC);
CREATE INDEX IF NOT EXISTS idx_sis_academic_status ON sis_student_records (academicstatus);
CREATE INDEX IF NOT EXISTS idx_sis_faculty ON sis_student_records (faculty);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_updated ON agent_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created ON agent_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user_created ON agent_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_pending_user_status ON agent_pending_actions (user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_heading ON rag_chunks (source_key, heading);
INSERT INTO escalation_policy_state(id,currentthreshold,minthreshold,maxthreshold,stepsize,updatedat,updatedby)
 SELECT 'GLOBAL_NVQS_POLICY',0.75,0.65,0.90,0.02,TO_CHAR(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'SYSTEM_INIT'
 WHERE NOT EXISTS (SELECT 1 FROM escalation_policy_state WHERE id='GLOBAL_NVQS_POLICY');
