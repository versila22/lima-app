#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    python3 -c "
import asyncio, asyncpg, os

async def check():
    url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(url)
    await conn.close()

asyncio.run(check())
" 2>/dev/null && echo "PostgreSQL is ready!" && break
    echo "Attempt $i/30 - PostgreSQL not ready, waiting 2s..."
    sleep 2
done

echo "Running migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
