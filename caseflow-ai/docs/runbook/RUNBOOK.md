# CASEFLOW AI - OPERATIONAL RUNBOOK

Follow these steps sequentially to set up, initialize, run, and verify the CaseFlow AI platform.

### Step 1: Clone Repository
```bash
git clone <repository_url>
cd caseflow-ai
```

### Step 2: Prepare SQL Server Database
Install SQL Server and Microsoft ODBC Driver 18 for SQL Server on the local machine.
Create a database named `CaseFlowAI`, then configure its instance and authentication details in `backend/.env`.

### Step 3: Set Up Python Backend Virtual Environment
```bash
cd backend
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate
```

### Step 4: Install Backend Dependencies
```bash
pip install -e .
pip install pytest pytest-asyncio pytest-cov
```

### Step 5: Configure Environment Variables
```bash
cp ../.env.example .env
# Edit .env to set DB_PASSWORD and optional GEMINI_API_KEY
```

### Step 6: Apply Database Migrations & Seed
```bash
alembic upgrade head
python -m app.db.seed
```

### Step 7: Launch FastAPI Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 8: Verify Health & API Docs
- Health Check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`

### Step 9: Set Up and Launch Frontend
In a new terminal window:
```bash
cd ../frontend
npm install
npm run dev
```
Open browser at: `http://localhost:5173`

### Step 10: Run Automated Tests
```bash
cd ../backend
pytest
```

### Step 11: Run Verification Harness
Navigate to `http://localhost:5173/verify` and click **RUN ALL TESTS**, or call via cURL:
```bash
curl -X POST http://localhost:8000/api/verify/run
```

### Vietnamese text and legacy question marks

Run these commands from `backend` using its virtual environment:

```bash
python -m alembic upgrade head
python scripts/repair_unicode.py
python scripts/repair_unicode.py --apply
python scripts/check_unicode.py
python -m pytest -q
```

Migration `0002_unicode_content` upgrades all 40 human-readable content columns
to Unicode, including databases partially updated by hand. Updating ORM models
alone does not change existing SQL Server columns. Restart the backend after
updating the models.

The repair command previews changes by default. With `--apply`, it saves the
original values, record IDs and replacement values to
`backend/storage/unicode-backups/` before updating anything. It only restores
exact matches to known source text damaged by the legacy Vietnamese code page;
unknown text and ordinary question punctuation are not rewritten. Keep the
backup private and retain it for recovery. Historical audit display-name repairs
are recorded in this backup; event IDs, actions and timestamps are preserved.

`check_unicode.py` scans project text encoding and verifies Vietnamese round
trips in a temporary table using each migrated column's actual SQL type. It does
not modify business records. The migration intentionally refuses downgrade
because converting back to a legacy code page can destroy Vietnamese characters.
