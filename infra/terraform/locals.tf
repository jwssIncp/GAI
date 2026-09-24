locals {
  name_prefix = "${var.project_name}-${var.environment}"

  public_subnet_cidrs  = [cidrsubnet(var.vpc_cidr, 4, 0), cidrsubnet(var.vpc_cidr, 4, 1)]
  private_subnet_cidrs = [cidrsubnet(var.vpc_cidr, 4, 2), cidrsubnet(var.vpc_cidr, 4, 3)]

  use_custom_domain = var.domain_name != ""
  create_acm        = local.use_custom_domain

  frontend_bucket_name = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"
  assets_bucket_name   = "${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}"

  container_name = "gai-backend"

  # Prefer custom domain; otherwise CloudFront domain (same-origin SPA+API).
  cors_origins = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.main.domain_name}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Managed prefix list so ALB only accepts traffic from CloudFront
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}
