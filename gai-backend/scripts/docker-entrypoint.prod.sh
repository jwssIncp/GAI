#!/usr/bin/env sh
set -eu

echo "Starting GAI backend (production)..."
exec node dist/src/main.js
