# EDUASSISTANT Runbook

This file replaces legacy CaseFlow AI instructions. The current source uses a
FastAPI backend, React/Vite frontend, and PostgreSQL. See the [canonical runbook](../../RUNBOOK.md)
for the full setup and operational steps.

## Current deployment and scope

- The only supported workflow is `MILITARY_SERVICE_CONFIRMATION`.
- The frontend is hosted at <https://edu-sp.pages.dev>; the Judge page is
  <https://edu-sp.pages.dev/judge>.
- The backend requires PostgreSQL through `DATABASE_URL`.
- The Admin SIS page manages internal demo records. It does not connect to a
  university SIS. Admin verification is enabled only for demo use and disabled
  in production by default.
- Gemini is the primary external AI provider; OpenRouter can run as fallback when
  configured. Without a usable key or live response, address analysis falls back
  to a deterministic parser and OCR returns no inferred document fields.
- HMAC-SHA256 checks stored-data integrity. It is not a PKI or legal digital
  signature.

## Local services

From the `EDUASSISTANT/` directory, install backend dependencies and configure
`DATABASE_URL`, then start the API:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.server:app --host 0.0.0.0 --port 3001 --reload
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The local API is at `http://localhost:3001`; the frontend is at
`http://localhost:5173`.

## Deterministic evaluation

The Verify Harness runs 9 in-memory cases without network calls, database access,
database writes, or AI calls:

```powershell
python -c "import sys; sys.path.insert(0, 'backend'); from app.services.verify_harness_service import run_verify_harness; print(run_verify_harness())"
```

Track A uses 18 fixed synthetic scenarios and does not call AI or depend on
network/database access:

```powershell
python benchmark/run_benchmark.py
```

Optional live address AI evaluation runs separately with
`python benchmark/run_live_ai_eval.py`. It can call Gemini when configured and
does not affect Track A metrics. User validation remains **PENDING** until real
participant evidence is recorded.
