# Onboarding = add the IAM user to this group (console or CLI). Grants:
# DB tunnel through the SSM bastion and read access to /gai/<env>/* (DB and platform
# admin credentials, deploy config). Editing parameters (rotation) stays with admins.

resource "aws_iam_group" "operators" {
  name = "${local.name_prefix}-operators"
}

resource "aws_iam_group_policy" "operators" {
  name  = "${local.name_prefix}-operators"
  group = aws_iam_group.operators.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "ReadParameters"
          Effect = "Allow"
          Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
          Resource = [
            "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_prefix}/*"
          ]
        },
        {
          Sid      = "DiscoverBastion"
          Effect   = "Allow"
          Action   = ["ec2:DescribeInstances", "ssm:DescribeInstanceInformation"]
          Resource = ["*"]
        },
        {
          Sid      = "ManageOwnSessions"
          Effect   = "Allow"
          Action   = ["ssm:TerminateSession", "ssm:ResumeSession"]
          Resource = ["arn:aws:ssm:*:*:session/$${aws:username}-*"]
        }
      ],
      var.enable_db_bastion ? [
        {
          Sid      = "StartDbTunnel"
          Effect   = "Allow"
          Action   = ["ssm:StartSession"]
          Resource = [
            aws_instance.bastion[0].arn,
            "arn:aws:ssm:${var.aws_region}::document/AWS-StartPortForwardingSessionToRemoteHost"
          ]
          Condition = {
            BoolIfExists = { "ssm:SessionDocumentAccessCheck" = "true" }
          }
        }
      ] : []
    )
  })
}
