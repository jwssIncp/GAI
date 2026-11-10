data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.github_branch_deploy}",
        "repo:${var.github_org}/${var.github_repo}:environment:${var.environment}",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${local.name_prefix}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json

  tags = {
    Name = "${local.name_prefix}-github-actions"
  }
}

resource "aws_iam_role_policy" "github_actions" {
  name = "${local.name_prefix}-github-actions"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = [aws_ecr_repository.backend.arn]
      },
      {
        Sid    = "ECSDeploy"
        Effect = "Allow"
        Action = [
          "ecs:DescribeClusters",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:ListTaskDefinitions",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:RunTask",
          "ecs:TagResource"
        ]
        Resource = ["*"]
      },
      {
        Sid    = "PassRole"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      },
      {
        Sid    = "FrontendS3"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObject"
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*"
        ]
      },
      {
        Sid    = "DeployConfig"
        Effect = "Allow"
        Action = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_prefix}/deploy",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_prefix}/deploy/*"
        ]
      },
      {
        Sid      = "ReleaseTaskLogs"
        Effect   = "Allow"
        Action   = ["logs:GetLogEvents"]
        Resource = ["${aws_cloudwatch_log_group.ecs.arn}:*"]
      },
      {
        Sid    = "CloudFrontInvalidation"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:GetDistribution"
        ]
        Resource = [aws_cloudfront_distribution.main.arn]
      },
      {
        # Pre-release snapshot (deploy-app.yml): create/inspect only, on this
        # instance and on snapshots with the pre-release prefix. No delete/restore.
        Sid    = "PreReleaseSnapshot"
        Effect = "Allow"
        Action = [
          "rds:CreateDBSnapshot",
          "rds:AddTagsToResource",
          "rds:DescribeDBSnapshots",
          "rds:DescribeDBInstances"
        ]
        Resource = [
          aws_db_instance.main.arn,
          "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:snapshot:${aws_db_instance.main.identifier}-pre-release-*"
        ]
      }
    ]
  })
}

# Snapshot retention (ops-rds-snapshots.yml), never in production: delete only
# pre-release snapshots of this instance carrying Purpose=pre-release.
resource "aws_iam_role_policy" "github_actions_snapshot_retention" {
  count = var.environment == "production" ? 0 : 1
  name  = "${local.name_prefix}-github-actions-snapshot-retention"
  role  = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PreReleaseSnapshotRetention"
        Effect    = "Allow"
        Action    = ["rds:DeleteDBSnapshot"]
        Resource  = ["arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:snapshot:${aws_db_instance.main.identifier}-pre-release-*"]
        Condition = { StringEquals = { "aws:ResourceTag/Purpose" = "pre-release" } }
      }
    ]
  })
}
