#!/usr/bin/env bash
set -Eeuo  pipefail

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-gai}"
DB_PASSWORD="${DB_PASSWORD:-gai}"

echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
until nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 2
done
echo "MySQL is ready."

MIGRATION_OUTPUT="$(npm run migration:show 2>&1 || true)"
EXECUTED_COUNT="$(echo "$MIGRATION_OUTPUT" | grep -c '^\[X\]' || true)"
PENDING_COUNT="$(echo "$MIGRATION_OUTPUT" | grep -c '^\[ \]' || true)"

if [ "$EXECUTED_COUNT" -eq 0 ] && [ "$PENDING_COUNT" -gt 0 ]; then
  echo "First boot detected — running migrations and seed..."
  npm run migration:run
  npm run seed:bootstrap
elif [ "$EXECUTED_COUNT" -gt 0 ] && [ "$PENDING_COUNT" -gt 0 ]; then
  echo "ERROR: Pending migrations detected."
  echo "$MIGRATION_OUTPUT"
  echo ""
  echo "Run manually: docker compose exec app npm run migration:run"
  exit 1
elif [ "$PENDING_COUNT" -gt 0 ]; then
  echo "Running pending migrations..."
  npm run migration:run
fi

echo "Starting application (hot-reload)..."
exec npm run start:dev
