#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "=== nvm install 24 ==="
nvm install 24
nvm alias default 24
nvm use 24

echo "=== VERIFY ==="
echo "node_v=$(node -v)"
echo "npm_v=$(npm -v)"
echo "which_node=$(which node)"

BASHRC="$HOME/.bashrc"
bashrc_updated=no
if ! grep -q 'NVM_DIR' "$BASHRC" 2>/dev/null; then
  cat >> "$BASHRC" <<'EOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
  bashrc_updated=yes
fi
echo "bashrc_updated=$bashrc_updated"

NVMRC="/home/luiz/GAI/.nvmrc"
nvmrc_created=no
if [ ! -f "$NVMRC" ]; then
  printf '24\n' > "$NVMRC"
  nvmrc_created=yes
fi
echo "nvmrc_created=$nvmrc_created"
echo "nvmrc_content=$(cat "$NVMRC")"
