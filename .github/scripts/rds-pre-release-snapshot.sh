#!/usr/bin/env bash
# Create a manual RDS snapshot right before the release task (migrations) and
# block until AWS reports it "available". Any failure (permissions, timeout,
# unexpected status) exits non-zero so the release and the ECS update never run.
# Writes snapshot_id to $GITHUB_OUTPUT (when set) for rollback.
set -euo pipefail

: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID missing - apply Infra (Terraform) first (deploy/rds-instance-id)}"
: "${ENV_NAME:?}"
RUN_ID="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
SNAPSHOT_ID="${RDS_INSTANCE_ID}-pre-release-${RUN_ID}"
TIMEOUT_SECONDS="${SNAPSHOT_TIMEOUT_SECONDS:-3600}"
POLL_SECONDS="${SNAPSHOT_POLL_SECONDS:-20}"

STATUS=$(aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" \
  --query 'DBInstances[0].DBInstanceStatus' --output text)
if [[ "$STATUS" != "available" ]]; then
  echo "RDS instance $RDS_INSTANCE_ID is '$STATUS' (expected 'available'); refusing to release."
  exit 1
fi

echo "Creating snapshot $SNAPSHOT_ID of $RDS_INSTANCE_ID ($ENV_NAME)"
aws rds create-db-snapshot \
  --db-instance-identifier "$RDS_INSTANCE_ID" \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --tags "Key=Purpose,Value=pre-release" "Key=Environment,Value=$ENV_NAME" "Key=Run,Value=$RUN_ID" \
  --query 'DBSnapshot.DBSnapshotIdentifier' --output text

DEADLINE=$(( $(date +%s) + TIMEOUT_SECONDS ))
while true; do
  SNAP_STATUS=$(aws rds describe-db-snapshots --db-snapshot-identifier "$SNAPSHOT_ID" \
    --query 'DBSnapshots[0].Status' --output text)
  case "$SNAP_STATUS" in
    available) break ;;
    creating|pending) ;;
    *) echo "Snapshot $SNAPSHOT_ID entered status '$SNAP_STATUS'; aborting release."; exit 1 ;;
  esac
  if (( $(date +%s) >= DEADLINE )); then
    echo "Snapshot $SNAPSHOT_ID not available after ${TIMEOUT_SECONDS}s; aborting release."
    exit 1
  fi
  sleep "$POLL_SECONDS"
done

echo "Snapshot verified: $SNAPSHOT_ID (available)"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then echo "snapshot_id=$SNAPSHOT_ID" >> "$GITHUB_OUTPUT"; fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "Pre-release RDS snapshot: \`$SNAPSHOT_ID\` (restore it to a NEW instance to recover data)." >> "$GITHUB_STEP_SUMMARY"
fi
