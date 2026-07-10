terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type = string
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

# RDS MySQL 8.0
resource "aws_db_subnet_group" "gai" {
  name       = "gai-${var.environment}-db-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "gai" {
  identifier              = "gai-${var.environment}"
  engine                  = "mysql"
  engine_version          = "8.0"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  db_name                 = "gai"
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.gai.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = var.environment != "production"
  backup_retention_period = var.environment == "production" ? 7 : 1
  parameter_group_name    = aws_db_parameter_group.gai.name
}

resource "aws_db_parameter_group" "gai" {
  name   = "gai-${var.environment}-mysql80"
  family = "mysql8.0"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }
}

resource "aws_security_group" "rds" {
  name        = "gai-${var.environment}-rds"
  description = "RDS access for GAI backend"
  vpc_id      = var.vpc_id
}

# ECS Fargate skeleton
resource "aws_ecs_cluster" "gai" {
  name = "gai-${var.environment}"
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

output "rds_endpoint" {
  value = aws_db_instance.gai.endpoint
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.gai.name
}
