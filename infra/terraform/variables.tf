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
  default = 7

  validation {
    condition     = var.db_backup_retention_days >= 7 || (var.environment != "production" && var.db_backup_retention_days >= 1)
    error_message = "Automated RDS backups are mandatory (>= 1 day) and production keeps at least 7 days."
  }
}

variable "alb_enforce_origin_header" {
  type        = bool
  description = "ALB forwards only requests carrying the CloudFront secret header (origin_protection.tf). Enable only after CloudFront already sends it."
  default     = false
}

variable "origin_verify_active_slot" {
  type        = string
  description = "Origin secret slot CloudFront sends (a|b); the ALB accepts both. Rotation: replace the inactive slot, then switch (origin_protection.tf)."
  default     = "a"

  validation {
    condition     = contains(["a", "b"], var.origin_verify_active_slot)
    error_message = "origin_verify_active_slot must be \"a\" or \"b\"."
  }
}

variable "mobile_retention_schedule_enabled" {
  type        = bool
  description = "Daily EventBridge Scheduler run of mobile:retention --apply (scheduler.tf). Enable after the first deploy registered the -release task definition."
  default     = false
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

variable "api_origin_domain_name" {
  type        = string
  description = "Optional hostname for TLS between CloudFront and the ALB (e.g. api-origin.exemplo.com, in hosted_zone_id). Empty keeps the HTTP origin."
  default     = ""

  validation {
    condition     = var.api_origin_domain_name == "" || var.hosted_zone_id != ""
    error_message = "api_origin_domain_name requires hosted_zone_id (DNS validation and alias record)."
  }
}

variable "alb_http_origin_enabled" {
  type        = bool
  description = "Keep ALB port 80 open to CloudFront. Set false only after the HTTPS origin is live (alb_https.tf)."
  default     = true

  validation {
    condition     = var.alb_http_origin_enabled || var.api_origin_domain_name != ""
    error_message = "Port 80 can only be closed when api_origin_domain_name enables the HTTPS origin."
  }
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
