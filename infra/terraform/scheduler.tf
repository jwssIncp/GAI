# Daily purge of unusable mobile refresh tokens / idempotency keys (Onda 4
# `mobile:retention`), as an ECS one-off task of the <family>-release task
# definition registered by deploy-app.yml (latest ACTIVE revision: the ARN has
# no revision). Disabled by default: enable after the first deploy that ran the
# Onda 1-3 migrations (mobile_retention_schedule_enabled = true).

locals {
  release_task_family_arn = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.backend.family}-release"
}

resource "aws_iam_role" "scheduler_retention" {
  count = var.mobile_retention_schedule_enabled ? 1 : 0
  name  = "${local.name_prefix}-scheduler-retention"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_retention" {
  count = var.mobile_retention_schedule_enabled ? 1 : 0
  name  = "${local.name_prefix}-scheduler-retention"
  role  = aws_iam_role.scheduler_retention[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = ["ecs:RunTask"]
        Resource  = [local.release_task_family_arn, "${local.release_task_family_arn}:*"]
        Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn } }
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
      }
    ]
  })
}

resource "aws_scheduler_schedule" "mobile_retention" {
  count = var.mobile_retention_schedule_enabled ? 1 : 0
  name  = "${local.name_prefix}-mobile-retention"

  # 06:00 UTC = 03:00 America/Sao_Paulo.
  schedule_expression = "cron(0 6 * * ? *)"
  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler_retention[0].arn

    ecs_parameters {
      task_definition_arn = local.release_task_family_arn
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = aws_subnet.private[*].id
        security_groups  = [aws_security_group.ecs.id]
        assign_public_ip = false
      }
    }

    input = jsonencode({
      containerOverrides = [{
        name    = local.container_name
        command = ["npm", "run", "mobile:retention:prod", "--", "--apply"]
      }]
    })

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
