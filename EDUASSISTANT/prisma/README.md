# Prisma Studio

Prisma uses the same `DATABASE_URL` as the FastAPI backend.

```powershell
npm install --save-dev prisma
npx prisma db pull
npx prisma studio
```

Studio opens locally at `http://localhost:5555`. Do not expose it publicly.
