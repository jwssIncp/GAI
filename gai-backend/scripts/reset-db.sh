#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/5] Stopping stack and removing volumes..."
docker compose down -v

echo "[2/5] Starting MySQL..."
docker compose up -d mysql

echo "[3/5] Waiting for MySQL to accept connections..."
for i in $(seq 1 60); do
  if docker compose exec -T mysql mysqladmin ping -ugai -pgai --silent 2>/dev/null; then
    echo "MySQL is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for MySQL." >&2
    exit 1
  fi
  sleep 2
done

echo "[4/5] Running migrations..."
npm run migration:run

echo "[5/5] Seeding bootstrap data..."
npm run seed:bootstrap

echo "Database reset complete."
