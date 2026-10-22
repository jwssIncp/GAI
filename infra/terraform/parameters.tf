# Single source of configuration and secrets: SSM Parameter Store under /gai/<env>/.
#   db/*              -> backend container (ECS secrets) and DB tunnel
#   platform-admin/*  -> release task only (migrations + root user bootstrap)
#   deploy/*          -> GitHub Actions (cluster, service, buckets...)
#
# Passwords are ephemeral + write-only: generated during apply, written to RDS and
# SSM, never stored in Terraform state or plan.
# To rotate the DB password: bump db_password_version, merge, then run the deploy.
# To rotate the admin password: edit the SSM parameter, then run "Ops - Reset platform admin".

locals {
  ssm_prefix = "/${var.project_name}/${var.environment}"

  # Bump whenever RDS is recreated so SecureString matches the new master password.
  db_password_version             = 4
  platform_admin_password_version = 1
  db_operator_password_version    = 1
}

ephemeral "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

ephemeral "random_password" "platform_admin" {
  length           = 24
  special          = true
  override_special = "!#%*-_=+"
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

ephemeral "random_password" "db_operator" {
  length           = 24
  special          = true
  override_special = "!#%*-_=+"
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

resource "aws_ssm_parameter" "db_password" {
  name             = "${local.ssm_prefix}/db/password"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.db.result
  value_wo_version = local.db_password_version
}

resource "aws_ssm_parameter" "db" {
  for_each = {
    host              = aws_db_instance.main.address
    port              = tostring(aws_db_instance.main.port)
    name              = aws_db_instance.main.db_name
    username          = nonsensitive(var.db_username)
    operator-username = var.db_operator_username
  }

  name  = "${local.ssm_prefix}/db/${each.key}"
  type  = "String"
  value = each.value
}

resource "aws_ssm_parameter" "db_operator_password" {
  name             = "${local.ssm_prefix}/db/operator-password"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.db_operator.result
  value_wo_version = local.db_operator_password_version
}

resource "aws_ssm_parameter" "platform_admin_password" {
  name             = "${local.ssm_prefix}/platform-admin/password"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.platform_admin.result
  value_wo_version = local.platform_admin_password_version
}

resource "aws_ssm_parameter" "platform_admin" {
  for_each = {
    login = var.platform_admin_login
    email = var.platform_admin_email
  }

  name  = "${local.ssm_prefix}/platform-admin/${each.key}"
  type  = "String"
  value = each.value
}

resource "aws_ssm_parameter" "deploy" {
  for_each = {
    ecs-cluster                = aws_ecs_cluster.main.name
    ecs-service                = aws_ecs_service.backend.name
    ecs-task-family            = aws_ecs_task_definition.backend.family
    ecs-subnets                = join(",", aws_subnet.private[*].id)
    ecs-security-groups        = aws_security_group.ecs.id
    ecr-repository             = aws_ecr_repository.backend.name
    frontend-bucket            = aws_s3_bucket.frontend.bucket
    cloudfront-distribution-id = aws_cloudfront_distribution.main.id
  }

  name  = "${local.ssm_prefix}/deploy/${each.key}"
  type  = "String"
  value = each.value
}
