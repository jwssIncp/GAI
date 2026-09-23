#!/usr/bin/env bash
# Push the first backend image after terraform apply (chicken-egg with :latest).
set -euo pipefail

ENV="${1:?Usage: $0 <homolog|production>}"
REGION="${AWS_REGION:-us-east-1}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/infra/terraform"

REPO_URL=$(terraform output -raw ecr_repository_url)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

cd "$ROOT/gai-backend"
docker build --target production -t "${REPO_URL}:latest" -t "${REPO_URL}:${ENV}" .
docker push "${REPO_URL}:latest"
docker push "${REPO_URL}:${ENV}"

CLUSTER=$(cd "$ROOT/infra/terraform" && terraform output -raw ecs_cluster_name)
SERVICE=$(cd "$ROOT/infra/terraform" && terraform output -raw ecs_service_name)

aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region "$REGION"
echo "Bootstrap image pushed and ECS service redeployed for ${ENV}."
