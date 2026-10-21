#!/usr/bin/env bash
# Export /gai/<env>/deploy/* (written by Terraform) to $GITHUB_ENV.
# e.g. /gai/homolog/deploy/ecs-cluster -> ECS_CLUSTER
set -euo pipefail

ENV_NAME="${1:?Usage: $0 <homolog|production>}"
PREFIX="/gai/${ENV_NAME}/deploy"

PARAMS=$(aws ssm get-parameters-by-path --path "$PREFIX" \
  --query 'Parameters[].[Name,Value]' --output text)

if [[ -z "$PARAMS" ]]; then
  echo "No parameters under $PREFIX - has the Infra (Terraform) workflow been applied?"
  exit 1
fi

while read -r name value; do
  key=$(basename "$name" | tr 'a-z-' 'A-Z_')
  echo "$key=$value" >> "$GITHUB_ENV"
  echo "$key=$value"
done <<< "$PARAMS"

echo "ENV_NAME=$ENV_NAME" >> "$GITHUB_ENV"
