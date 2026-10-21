variable "aws_region" {
  type        = string
  description = "Primary AWS region for the stack"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name (homolog | production)"

  validation {
    condition     = contains(["homolog", "production"], var.environment)
    error_message = "environment must be homolog or production"
  }
}

variable "project_name" {
  type    = string
  default = "gai"
}

variable "github_org" {
  type        = string
  description = "GitHub organization or user that owns the repo"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (without org)"
  default     = "GAI"
}

variable "github_branch_deploy" {
  type        = string
  description = "Branch allowed to assume the deploy role (in addition to environment refs)"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Exactly two AZs"
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Provide exactly two availability zones"
  }
}

variable "nat_gateway_count" {
  type        = number
  description = "1 = cost-optimized (homolog); 2 = HA (production)"
  default     = 1

  validation {
    condition     = contains([1, 2], var.nat_gateway_count)
    error_message = "nat_gateway_count must be 1 or 2"
  }
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "db_username" {
  type      = string
  sensitive = true
  default   = "gai_admin"
}

variable "platform_admin_login" {
  type    = string
  default = "platform.admin"
}

variable "platform_admin_email" {
  type    = string
  default = "admin@gai.local"
}

variable "enable_db_bastion" {
  type        = bool
  description = "Optional SSM bastion for private DB access. Off by default until a secure operator flow exists."
  default     = false
}

# Homolog-only palliative: DBeaver reaches the RDS endpoint directly (no VPN yet).
# Production must keep db_publicly_accessible = false. Replace with Client VPN before prod.
variable "db_publicly_accessible" {
  type        = bool
  description = "Expose RDS with a public IP (homolog palliative only)"
  default     = false

  validation {
    condition     = !(var.environment == "production" && var.db_publicly_accessible)
    error_message = "db_publicly_accessible must be false in production"
  }
}

variable "db_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to MySQL when db_publicly_accessible (e.g. [\"1.2.3.4/32\"]). Never 0.0.0.0/0."
  default     = []

  validation {
    condition = (
      !var.db_publicly_accessible || (
        length(var.db_allowed_cidrs) > 0 &&
        !contains(var.db_allowed_cidrs, "0.0.0.0/0")
      )
    )
    error_message = "When db_publicly_accessible is true, set db_allowed_cidrs to one or more /32 (or narrow) CIDRs; 0.0.0.0/0 is forbidden"
  }
}

variable "db_operator_username" {
  type        = string
  description = "MySQL user for DBeaver/ops (created by release:prod); not the master user"
  default     = "gai_admin_ops"
}

# Read by Infra workflow (grep); declare so -var-file does not error. Not used in resources.
variable "db_force_replace" {
  type        = bool
  description = "When true, CI plans with -replace=aws_db_instance.main (same-VPC public flip)"
  default     = false
}

variable "ecs_cpu" {
  type    = number
  default = 256
}

variable "ecs_memory" {
  type    = number
  default = 512
}

variable "ecs_desired_count" {
  type    = number
  default = 1
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "domain_name" {
  type        = string
  description = "Optional custom domain (e.g. app.exemplo.com). Leave empty to use CloudFront default domain."
  default     = ""
}

variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID when domain_name is set"
  default     = ""
}

variable "alert_email" {
  type        = string
  description = "Optional email for CloudWatch alarm SNS (leave empty to skip)"
  default     = ""
}

variable "ses_from_email" {
  type        = string
  description = "Verified SES sender address"
  default     = "noreply@example.com"
}
