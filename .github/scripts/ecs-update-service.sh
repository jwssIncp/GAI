#!/usr/bin/env bash
# Force a new ECS deployment and wait until the expected task definition is primary
# and stable. Blind `aws ecs wait services-stable` can succeed after a circuit-breaker
# rollback to the previous revision, so we assert the registered ARN stayed primary.
set -euo pipefail

: "${ECS_CLUSTER:?}"
: "${ECS_SERVICE:?}"
: "${EXPECTED_TASK_DEFINITION:?}"

TIMEOUT_SECONDS="${ECS_STABILITY_TIMEOUT_SECONDS:-600}"
POLL_SECONDS="${ECS_STABILITY_POLL_SECONDS:-15}"

echo "Updating service $ECS_SERVICE on $ECS_CLUSTER -> $EXPECTED_TASK_DEFINITION"
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$EXPECTED_TASK_DEFINITION" \
  --force-new-deployment \
  --query 'service.{desired:desiredCount,running:runningCount,taskDefinition:taskDefinition,deployments:deployments[*].{status:status,taskDefinition:taskDefinition,rollout:rolloutState}}' \
  --output json

deadline=$((SECONDS + TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  DESCRIPTION=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,deployments:deployments[*].{id:id,status:status,desired:desiredCount,running:runningCount,pending:pendingCount,failed:failedTasks,rollout:rolloutState,reason:rolloutStateReason,taskDefinition:taskDefinition},events:events[:5]}' \
    --output json)
  echo "$DESCRIPTION"

  PRIMARY=$(jq -r '.deployments[] | select(.status=="PRIMARY")' <<<"$DESCRIPTION")
  PRIMARY_TD=$(jq -r '.taskDefinition' <<<"$PRIMARY")
  ROLLOUT=$(jq -r '.rollout' <<<"$PRIMARY")
  DEPLOY_COUNT=$(jq -r '.deployments | length' <<<"$DESCRIPTION")
  DESIRED=$(jq -r '.desired' <<<"$DESCRIPTION")
  RUNNING=$(jq -r '.running' <<<"$DESCRIPTION")
  PENDING=$(jq -r '.pending' <<<"$DESCRIPTION")

  if [[ "$ROLLOUT" == "FAILED" ]]; then
    echo "Primary deployment rollout FAILED"
    break
  fi

  if [[ "$PRIMARY_TD" == "$EXPECTED_TASK_DEFINITION" \
     && "$ROLLOUT" == "COMPLETED" \
     && "$DEPLOY_COUNT" == "1" \
     && "$RUNNING" == "$DESIRED" \
     && "$PENDING" == "0" ]]; then
    echo "Service stable on expected task definition."
    exit 0
  fi

  if [[ "$PRIMARY_TD" != "$EXPECTED_TASK_DEFINITION" && "$ROLLOUT" == "COMPLETED" && "$DEPLOY_COUNT" == "1" ]]; then
    echo "Service stabilized on unexpected task definition after rollback:"
    echo "  expected: $EXPECTED_TASK_DEFINITION"
    echo "  actual:   $PRIMARY_TD"
    break
  fi

  sleep "$POLL_SECONDS"
done

echo "----- recent stopped tasks -----"
STOPPED=$(aws ecs list-tasks \
  --cluster "$ECS_CLUSTER" \
  --service-name "$ECS_SERVICE" \
  --desired-status STOPPED \
  --query 'taskArns[:3]' \
  --output text)
if [[ -n "${STOPPED:-}" && "$STOPPED" != "None" ]]; then
  aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks $STOPPED \
    --query 'tasks[].{taskArn:taskArn,stoppedReason:stoppedReason,containers:containers[].{name:name,exitCode:exitCode,reason:reason}}' \
    --output json || true
  for TASK_ARN in $STOPPED; do
    STREAM="backend/gai-backend/${TASK_ARN##*/}"
    echo "----- logs $STREAM -----"
    aws logs get-log-events \
      --log-group-name "/ecs/${ECS_CLUSTER}" \
      --log-stream-name "$STREAM" \
      --limit 40 \
      --query 'events[].message' --output text 2>/dev/null | tr '\t' '\n' || true
  done
fi

echo "ECS service did not become stable on $EXPECTED_TASK_DEFINITION within ${TIMEOUT_SECONDS}s"
exit 1
