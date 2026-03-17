#!/bin/sh
set -e
if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running Prisma migrations (RUN_MIGRATIONS=true)..."
  if ! npx prisma migrate deploy; then
    echo "WARNING: Prisma migrate deploy failed (check DATABASE_URL and DB connectivity). Starting app anyway."
  fi
else
  echo "Skipping Prisma migrations (set RUN_MIGRATIONS=true to enable)."
fi
echo "Starting application..."
exec node dist/index.js
