#!/bin/sh
set -e
echo "Running Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "WARNING: Prisma migrate deploy failed (check DATABASE_URL and DB connectivity). Starting app anyway."
fi
echo "Starting application..."
exec node dist/index.js
