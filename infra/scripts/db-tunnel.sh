#!/usr/bin/env bash
# Open a local port forwarded to the private RDS through the SSM bastion.
# Needs only AWS CLI v2 + session-manager-plugin and an IAM user in the
# gai-<env>-operators group (no Terraform, no local state).
# Usage:
#   ./infra/scripts/db-tunnel.sh homolog [porta_local]   (default 13306)
# Keep it running and point DBeaver (Windows or WSL) at localhost:<porta_local>.
set -euo pipefail

ENV="${1:?Usage: $0 <homolog|production> [porta_local]}"
LOCAL_PORT="${2:-13306}"
REGION="${AWS_REGION:-us-east-1}"
PREFIX="gai-${ENV}"

if ! command -v session-manager-plugin >/dev/null; then
  cat <<'EOF'
session-manager-plugin nao encontrado. Instale no WSL (Ubuntu):
  curl -fsSLo /tmp/ssm.deb https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb
  sudo dpkg -i /tmp/ssm.deb
EOF
  exit 1
fi

INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=${PREFIX}-db-bastion" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "Bastion ${PREFIX}-db-bastion nao encontrado/rodando (enable_db_bastion = true no env/${ENV}.tfvars?)."
  exit 1
fi

param() {
  aws ssm get-parameter --region "$REGION" --name "/gai/${ENV}/db/$1" --with-decryption \
    --query Parameter.Value --output text
}
RDS_HOST=$(param host)

cat <<EOF
=============================================================
 Tunel para RDS ($ENV) - deixe este terminal aberto
 DBeaver -> MySQL
   Host:     localhost
   Porta:    $LOCAL_PORT
   Database: $(param name)
   Usuario:  $(param username)
   Senha:    $(param password)
   Driver properties: allowPublicKeyRetrieval=true
=============================================================
EOF

aws ssm start-session --region "$REGION" \
  --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$RDS_HOST\"],\"portNumber\":[\"3306\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}"
