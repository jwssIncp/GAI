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

TASK_COMMAND="${TASK_COMMAND:-[\"npm\", \"run\", \"release:prod\"]}"

OVERRIDES=$(jq -nc \
  --arg name "$CONTAINER_NAME" \
  --argjson command "$TASK_COMMAND" \
  '{
    containerOverrides: [{
      name: $name,
      command: $command
    }]
  }')

# One release/ops task at a time per cluster (deploys, Ops workflows): a task
# left running by an interrupted job must finish before another one starts.
STARTED_BY="${STARTED_BY:-gai-release}"
RUNNING=$(aws ecs list-tasks --cluster "$ECS_CLUSTER" --started-by "$STARTED_BY" \
  --desired-status RUNNING --query 'length(taskArns)' --output text)
if [[ "$RUNNING" != "0" ]]; then
  echo "Another release/ops task ($STARTED_BY) is still running on $ECS_CLUSTER; refusing to start a concurrent one."
  exit 1
fi
# Scheduled runs (EventBridge mobile:retention) carry no started-by tag but use
# the same -release family. The MySQL named lock (scripts/with-db-lock.cjs) is
# the final guard inside the task; this check just fails fast.
if [[ -n "${ECS_TASK_FAMILY:-}" ]]; then
  RUNNING_FAMILY=$(aws ecs list-tasks --cluster "$ECS_CLUSTER" --family "${ECS_TASK_FAMILY}-release" \
    --desired-status RUNNING --query 'length(taskArns)' --output text)
  if [[ "$RUNNING_FAMILY" != "0" ]]; then
    echo "A ${ECS_TASK_FAMILY}-release task (e.g. scheduled retention) is running; retry after it finishes."
    exit 1
  fi
fi

echo "Starting migration task with definition: $ECS_TASK_DEFINITION"
TASK_ARN=$(aws ecs run-task \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$ECS_TASK_DEFINITION" \
  --launch-type FARGATE \
  --started-by "$STARTED_BY" \
  --network-configuration "$NETWORK_CONFIG" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' \
  --output text)

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "Failed to start migration task"
  exit 1
fi

echo "Migration task: $TASK_ARN"
# `aws ecs wait tasks-stopped` gives up after ~10 min while the task keeps
# running; poll with an explicit deadline and never continue without an exit code.
TIMEOUT_SECONDS="${RELEASE_TIMEOUT_SECONDS:-3600}"
POLL_SECONDS="${RELEASE_POLL_SECONDS:-15}"
DEADLINE=$(( $(date +%s) + TIMEOUT_SECONDS ))
while true; do
  LAST_STATUS=$(aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" \
    --query 'tasks[0].lastStatus' --output text)
  [[ "$LAST_STATUS" == "STOPPED" ]] && break
  if (( $(date +%s) >= DEADLINE )); then
    echo "Release task still $LAST_STATUS after ${TIMEOUT_SECONDS}s. Not updating the service;"
    echo "inspect $TASK_ARN (it may still be migrating) before any retry."
    exit 1
  fi
  sleep "$POLL_SECONDS"
done

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK_ARN" \
  --query "tasks[0].containers[?name=='$CONTAINER_NAME'].exitCode | [0]" \
  --output text)

echo "----- task logs -----"
aws logs get-log-events \
  --log-group-name "/ecs/${ECS_CLUSTER}" \
  --log-stream-name "backend/${CONTAINER_NAME}/${TASK_ARN##*/}" \
  --query 'events[].message' --output text | tr '\t' '\n' || true
echo "---------------------"

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
