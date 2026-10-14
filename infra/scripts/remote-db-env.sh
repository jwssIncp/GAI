#!/usr/bin/env bash
# Debug only: run the local backend against a remote DB through db-tunnel.sh.
# Prints DB_* exports (process env wins over gai-backend/.env). Nothing is written to disk.
# Usage (with ./infra/scripts/db-tunnel.sh homolog running in another terminal):
#   eval "$(./infra/scripts/remote-db-env.sh homolog)" && cd gai-backend && npm run start:dev
# Careful: this is the real homolog database.
set -euo pipefail

ENV="${1:?Usage: $0 <homolog|production> [porta_local]}"
LOCAL_PORT="${2:-13306}"
REGION="${AWS_REGION:-us-east-1}"

param() {
  aws ssm get-parameter --region "$REGION" --name "/gai/${ENV}/db/$1" --with-decryption \
    --query Parameter.Value --output text
}

printf 'export DB_HOST=%q\n' "127.0.0.1"
printf 'export DB_PORT=%q\n' "$LOCAL_PORT"
printf 'export DB_DATABASE=%q\n' "$(param name)"
printf 'export DB_USERNAME=%q\n' "$(param username)"
printf 'export DB_PASSWORD=%q\n' "$(param password)"
