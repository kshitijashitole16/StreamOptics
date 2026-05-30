# StreamOptics Infrastructure Quick Start

This project uses Docker Compose for a local PostgreSQL database that matches the backend Prisma connection string:

`postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public`

## 1) Start PostgreSQL (detached)

From the repo root:

```bash
docker compose up -d
```

## 2) Verify container startup logs

```bash
docker compose logs -f postgres
```

Look for messages like `database system is ready to accept connections`.

## 3) Stop services when done

```bash
docker compose down
```

The `postgres_data` named volume keeps your data between restarts.

## 4) Prisma connection verification checklist

1. Confirm backend env file exists and has the expected URL:
   - `backend/.env`
   - `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public"`
2. Push schema to PostgreSQL:

```bash
npm --prefix backend exec -- prisma db push \
  --config "/Users/vikasbairwa/Documents/StreamOptics/backend/prisma.config.ts" \
  --schema "/Users/vikasbairwa/Documents/StreamOptics/backend/prisma/schema.prisma" \
  --url "postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public"
```

3. If successful, P1001 is resolved. Then start backend:

```bash
npm --prefix backend run dev
```
