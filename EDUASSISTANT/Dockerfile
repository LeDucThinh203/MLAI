FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    NODE_ENV=production \
    ALLOW_ADMIN_VERIFIED_DEMO_SIS=false

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY benchmark ./benchmark
COPY docs ./docs
COPY RUNBOOK.md ./RUNBOOK.md

EXPOSE 3001

CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "3001"]
