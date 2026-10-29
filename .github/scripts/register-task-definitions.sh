#!/usr/bin/env bash
# Register two task definitions from the rendered one, with secrets from Parameter Store:
#   <family>          app (ECS service): DB_* only
#   <family>-release  one-off release: DB_* + PLATFORM_ADMIN_* + DB_OPERATOR_*
# Writes task_definition_arn and release_task_definition_arn to $GITHUB_OUTPUT.
set -euo pipefail

FILE="${1:?Usage: $0 <task-definition.json>}"
: "${ENV_NAME:?}"
: "${AWS_REGION:?}"
CONTAINER_NAME="${CONTAINER_NAME:-gai-backend}"

# Reconcile versioned document settings even when the current AWS task predates
# the Terraform change. This step has no remote side effects.
node "$(dirname "$0")/prepare-document-task.cjs" "$FILE" task-definition-documents.json "$CONTAINER_NAME"
FILE=task-definition-documents.json

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
P="arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter/gai/${ENV_NAME}"

register() {
  local suffix="$1" with_admin="$2"
  jq --arg p "$P" --arg name "$CONTAINER_NAME" --arg suffix "$suffix" --argjson admin "$with_admin" '
    .family += $suffix
    | .containerDefinitions |= map(
        if .name == $name then
          .secrets = [
            { name: "DB_HOST", valueFrom: ($p + "/db/host") },
            { name: "DB_PORT", valueFrom: ($p + "/db/port") },
            { name: "DB_USERNAME", valueFrom: ($p + "/db/username") },
            { name: "DB_PASSWORD", valueFrom: ($p + "/db/password") },
            { name: "DB_DATABASE", valueFrom: ($p + "/db/name") }
          ] + (if $admin then [
            { name: "PLATFORM_ADMIN_LOGIN", valueFrom: ($p + "/platform-admin/login") },
            { name: "PLATFORM_ADMIN_EMAIL", valueFrom: ($p + "/platform-admin/email") },
            { name: "PLATFORM_ADMIN_PASSWORD", valueFrom: ($p + "/platform-admin/password") },
            { name: "DB_OPERATOR_USERNAME", valueFrom: ($p + "/db/operator-username") },
            { name: "DB_OPERATOR_PASSWORD", valueFrom: ($p + "/db/operator-password") }
          ] else [] end)
        else . end
      )' "$FILE" > task-definition-final.json

  aws ecs register-task-definition \
    --cli-input-json file://task-definition-final.json \
    --query 'taskDefinition.taskDefinitionArn' --output text
}

APP_ARN=$(register "" false)
RELEASE_ARN=$(register "-release" true)
echo "Registered $APP_ARN"
echo "Registered $RELEASE_ARN"
echo "task_definition_arn=$APP_ARN" >> "$GITHUB_OUTPUT"
echo "release_task_definition_arn=$RELEASE_ARN" >> "$GITHUB_OUTPUT"
