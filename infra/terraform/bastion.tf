# SSM-only bastion for DB access (DBeaver etc.) via port forwarding.
# No public IP, no SSH, no inbound rules: access is controlled by IAM (ssm:StartSession).

data "aws_ssm_parameter" "bastion_ami" {
  count = var.enable_db_bastion ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_iam_policy_document" "bastion_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "bastion" {
  count              = var.enable_db_bastion ? 1 : 0
  name               = "${local.name_prefix}-db-bastion"
  assume_role_policy = data.aws_iam_policy_document.bastion_assume.json
}

resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  count      = var.enable_db_bastion ? 1 : 0
  role       = aws_iam_role.bastion[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  count = var.enable_db_bastion ? 1 : 0
  name  = "${local.name_prefix}-db-bastion"
  role  = aws_iam_role.bastion[0].name
}

resource "aws_security_group" "bastion" {
  count       = var.enable_db_bastion ? 1 : 0
  name        = "${local.name_prefix}-db-bastion"
  description = "SSM bastion - no inbound, outbound to SSM and RDS"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-db-bastion"
  }
}

resource "aws_vpc_security_group_egress_rule" "bastion_all" {
  count             = var.enable_db_bastion ? 1 : 0
  security_group_id = aws_security_group.bastion[0].id
  description       = "Outbound for SSM endpoints and RDS"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_bastion" {
  count                        = var.enable_db_bastion ? 1 : 0
  security_group_id            = aws_security_group.rds.id
  description                  = "MySQL from SSM bastion"
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = aws_security_group.bastion[0].id
}

resource "aws_instance" "bastion" {
  count                  = var.enable_db_bastion ? 1 : 0
  ami                    = data.aws_ssm_parameter.bastion_ami[0].insecure_value
  instance_type          = "t4g.nano"
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.bastion[0].id]
  iam_instance_profile   = aws_iam_instance_profile.bastion[0].name

  associate_public_ip_address = false

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  tags = {
    Name = "${local.name_prefix}-db-bastion"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}
