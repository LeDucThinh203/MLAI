# CASEFLOW AI - OPERATIONAL RUNBOOK

Follow these steps sequentially to set up, initialize, run, and verify the CaseFlow AI platform.

### Step 1: Clone Repository
```bash
git clone <repository_url>
cd caseflow-ai
```

### Step 2: Start SQL Server Database Container
```bash
docker compose up -d
```
Verify container is healthy:
```bash
docker ps
```

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
