resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.environment == "production" ? 30 : 14
}

resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = var.environment == "production" ? "enabled" : "disabled"
  }

  tags = {
    Name = local.name_prefix
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  # Two bounded 256 MiB renderer heaps plus Node, native buffers and HTTP work.
  # Capacity floor is prepared locally; AWS load/restore validation is pending.
  cpu                = max(var.ecs_cpu, 1024)
  memory             = max(var.ecs_memory, max(var.ecs_cpu, 1024) * 2)
  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = local.container_name
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "DOCUMENT_STORAGE", value = "database" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "CORS_ORIGINS", value = local.cors_origins },
        { name = "USE_MOCK_EMAIL", value = var.environment == "homolog" ? "true" : "false" },
        { name = "SES_FROM_EMAIL", value = var.ses_from_email },
        { name = "INVENTORY_ITEM_IMAGE_STORAGE_PROVIDER", value = "s3" },
        { name = "INVENTORY_ITEM_IMAGE_STORAGE_BUCKET", value = aws_s3_bucket.assets.bucket },
        { name = "INVENTORY_ITEM_IMAGE_MAX_SIZE_BYTES", value = "10485760" },
        { name = "INVENTORY_ITEM_IMAGE_MAX_PER_ITEM", value = "3" },
        { name = "INVENTORY_ITEM_IMAGE_PRESIGNED_URL_TTL_SECONDS", value = "300" },
        { name = "STORAGE_PROVIDER", value = "s3" },
        { name = "STORAGE_BUCKET", value = aws_s3_bucket.assets.bucket },
        { name = "STORAGE_PRESIGNED_URL_TTL_SECONDS", value = "300" },
        { name = "STORAGE_MAX_SIZE_BYTES", value = "52428800" },
        { name = "STORAGE_ALLOWED_MIME_TYPES", value = "image/jpeg,image/jpg,image/png,image/webp,application/pdf,application/json,text/plain,text/csv,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { name = "STORAGE_FORCE_PATH_STYLE", value = "false" },
        { name = "DB_LOGGING", value = "false" }
      ]

      # Initial revision only; CI (.github/scripts/register-task-definitions.sh) owns it afterwards.
      secrets = [
        { name = "DB_HOST", valueFrom = aws_ssm_parameter.db["host"].arn },
        { name = "DB_PORT", valueFrom = aws_ssm_parameter.db["port"].arn },
        { name = "DB_USERNAME", valueFrom = aws_ssm_parameter.db["username"].arn },
        { name = "DB_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
        { name = "DB_DATABASE", valueFrom = aws_ssm_parameter.db["name"].arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"require('http').get('http://127.0.0.1:${var.container_port}/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-backend"
  }

  # Image tag is updated by CI/CD; ignore drift on container image.
  lifecycle {
    ignore_changes = [
      container_definitions,
    ]
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = local.container_name
    container_port   = var.container_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 120

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${local.name_prefix}-backend"
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}
