#!/usr/bin/env bash
# Run DB migrations once via ECS RunTask (new image) before rolling the service.
set -euo pipefail

: "${ECS_CLUSTER:?}"
: "${ECS_TASK_DEFINITION:?}"
: "${ECS_SUBNETS:?}"
: "${ECS_SECURITY_GROUPS:?}"
: "${AWS_REGION:?}"

CONTAINER_NAME="${CONTAINER_NAME:-gai-backend}"

NETWORK_CONFIG=$(jq -nc \
  --arg subnets "$ECS_SUBNETS" \
  --arg sgs "$ECS_SECURITY_GROUPS" \
  '{
    awsvpcConfiguration: {
      subnets: ($subnets | split(",")),
      securityGroups: ($sgs | split(",")),
      assignPublicIp: "DISABLED"
    }
  }')

OVERRIDES=$(jq -nc \
  --arg name "$CONTAINER_NAME" \
  '{
    containerOverrides: [{
      name: $name,
      command: ["npm", "run", "migration:run:prod"]
    }]
  }')

echo "Starting migration task with definition: $ECS_TASK_DEFINITION"
TASK_ARN=$(aws ecs run-task \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$ECS_TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "$NETWORK_CONFIG" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' \
  --output text)

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "Failed to start migration task"
  exit 1
fi

echo "Migration task: $TASK_ARN"
aws ecs wait tasks-stopped --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN"

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK_ARN" \
  --query "tasks[0].containers[?name=='$CONTAINER_NAME'].exitCode | [0]" \
  --output text)

echo "Migration container exit code: $EXIT_CODE"
if [[ "$EXIT_CODE" != "0" ]]; then
  REASON=$(aws ecs describe-tasks \
    --cluster "$ECS_CLUSTER" \
    --tasks "$TASK_ARN" \
    --query 'tasks[0].stoppedReason' \
    --output text)
  echo "Migration failed: $REASON"
  exit 1
fi

echo "Migrations completed successfully."
