# Private subnet group (default / production).
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-db"
  }
}

# Homolog palliative: public subnets. AWS rejects same-VPC subnet-group *moves*.
# To flip public access, dispatch Infra with replace_rds=true (destroys + creates).
resource "aws_db_subnet_group" "public" {
  count = var.db_publicly_accessible ? 1 : 0

  name       = "${local.name_prefix}-db-public"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Name = "${local.name_prefix}-db-public"
  }
}

# MySQL 8.4 LTS (8.0 left RDS standard support; Extended Support is billed).
# A family change needs a new group: create it before the instance switches to it.
resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-mysql84"
  family = "mysql8.4"

  lifecycle {
    create_before_destroy = true
  }

  # Every client (ECS app, release task, db-lock) connects with DB_SSL=amazon-rds.
  parameter {
    name  = "require_secure_transport"
    value = "1"
  }

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }

  # Private mediumblob artifacts are limited to 10 MiB by the application.
  parameter {
    name  = "max_allowed_packet"
    value = "33554432"
  }
}

resource "aws_db_instance" "main" {
  identifier = local.name_prefix
  engine     = "mysql"

  # Major version only: RDS picks the default 8.4.x and auto_minor_version_upgrade
  # keeps it current without drift in this file.
  engine_version              = "8.4"
  allow_major_version_upgrade = true

  # Homolog has no real data: apply engine/parameter changes now, not in the
  # maintenance window. Production keeps changes for the window.
  apply_immediately = var.environment != "production"

  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = var.environment == "production" ? 100 : 40
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name             = "gai"
  username            = var.db_username
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = local.db_password_version

  db_subnet_group_name = (
    var.db_publicly_accessible
    ? aws_db_subnet_group.public[0].name
    : aws_db_subnet_group.main.name
  )
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = var.db_publicly_accessible
  multi_az               = var.db_multi_az

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final" : null
  copy_tags_to_snapshot     = true

  auto_minor_version_upgrade = true

  tags = {
    Name = local.name_prefix
  }
}
