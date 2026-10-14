#!/usr/bin/env bash
# Diagnose login issues and create/reset the platform admin via a one-off ECS task.
# Usage:
#   ADMIN_PASSWORD='SuaSenha!2026' ./infra/scripts/reset-admin.sh homolog
# Optional: ADMIN_LOGIN (default platform.admin), ADMIN_EMAIL (default admin@gai.local)
set -euo pipefail

ENV="${1:?Usage: ADMIN_PASSWORD=... $0 <homolog|production>}"
: "${ADMIN_PASSWORD:?Defina ADMIN_PASSWORD}"
REGION="${AWS_REGION:-us-east-1}"
CONTAINER="gai-backend"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/infra/terraform"

CLUSTER=$(terraform output -raw ecs_cluster_name)
TASKDEF=$(terraform output -raw ecs_task_definition_family)
SUBNETS=$(terraform output -json private_subnet_ids | tr -d '[]" \n')
SG=$(terraform output -raw ecs_security_group_id)

if [[ "$CLUSTER" != *"$ENV"* ]]; then
  echo "O state ativo do Terraform e de '$CLUSTER', nao de '$ENV'."
  echo "Rode: terraform init -backend-config=env/${ENV}.backend.hcl -reconfigure"
  exit 1
fi

b64() { printf '%s' "$1" | base64 -w0; }
SCRIPT_B64=$(base64 -w0 "$ROOT/infra/scripts/reset-admin.cjs")

OVERRIDES=$(cat <<EOF
{"containerOverrides":[{"name":"$CONTAINER",
 "command":["node","-e","eval(Buffer.from(process.env.SCRIPT_B64,'base64').toString())"],
 "environment":[
  {"name":"SCRIPT_B64","value":"$SCRIPT_B64"},
  {"name":"ADMIN_PASSWORD_B64","value":"$(b64 "$ADMIN_PASSWORD")"},
  {"name":"ADMIN_LOGIN_B64","value":"$(b64 "${ADMIN_LOGIN:-platform.admin}")"},
  {"name":"ADMIN_EMAIL_B64","value":"$(b64 "${ADMIN_EMAIL:-admin@gai.local}")"}
 ]}]}
EOF
)

echo "Iniciando task em $CLUSTER ($TASKDEF)..."
TASK_ARN=$(aws ecs run-task --region "$REGION" \
  --cluster "$CLUSTER" --task-definition "$TASKDEF" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' --output text)

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "Falha ao iniciar a task."
  exit 1
fi

TASK_ID="${TASK_ARN##*/}"
echo "Task: $TASK_ID - aguardando terminar (1-3 min)..."
aws ecs wait tasks-stopped --region "$REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN"

echo "----- saida -----"
aws logs get-log-events --region "$REGION" \
  --log-group-name "/ecs/gai-${ENV}" \
  --log-stream-name "backend/${CONTAINER}/${TASK_ID}" \
  --query 'events[].message' --output text | tr '\t' '\n'
echo "-----------------"

aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query "tasks[0].{exitCode:containers[0].exitCode,stoppedReason:stoppedReason}" --output table
