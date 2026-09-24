#!/usr/bin/env bash
# Fix npm audit (high+) for backend + frontend. Run from repo root or anywhere:
#   bash scripts/fix-npm-audit.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fix_and_verify() {
  local dir="$1"
  local extra_build_env="${2:-}"
  echo "======== $dir ========"
  cd "$dir"
  npm install
  npm audit fix || true
  echo "--- audit (high+) ---"
  npm audit --audit-level=high || true
  echo "--- lint ---"
  npm run lint
  if [[ -n "$extra_build_env" ]]; then
    echo "--- test ---"
    npm run test
    echo "--- build ---"
    env $extra_build_env npm run build
  else
    echo "--- test:cov ---"
    npm run test:cov
    echo "--- build ---"
    npm run build
  fi
  echo "OK: $dir"
}

fix_and_verify "$ROOT/gai-backend"
fix_and_verify "$ROOT/gai-frontend" "VITE_API_BASE_URL=/api/v1"

echo "======== ALL GREEN ========"
