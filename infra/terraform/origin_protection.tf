# Origin verification: only our CloudFront distribution may reach the ALB.
#
# The ALB security group admits the whole CloudFront prefix list, i.e. any
# distribution of any AWS account. CloudFront adds a secret header (it
# overwrites a viewer-supplied header with the same name) and the ALB forwards
# only requests carrying it.
#
# Rollout in two applies (no 403 window while CloudFront propagates):
#   1) default (alb_enforce_origin_header = false): CloudFront starts sending it
#   2) alb_enforce_origin_header = true: ALB default action becomes 403 and a
#      listener rule forwards only requests with the header.
# Secrets are generated here (never in code/tfvars). Like every CloudFront
# origin header they live in the encrypted Terraform state (sensitive: masked
# in plan output). Two slots make rotation downtime-free: the ALB accepts both,
# CloudFront sends the active one.
#   Rotate: (1) apply -replace=random_password.origin_verify_<inactive>
#           (2) set origin_verify_active_slot to that slot and apply.

resource "random_password" "origin_verify_a" {
  length  = 48
  special = false
}

resource "random_password" "origin_verify_b" {
  length  = 48
  special = false
}

moved {
  from = random_password.origin_verify
  to   = random_password.origin_verify_a
}

locals {
  origin_verify_header = "X-Origin-Verify"
  origin_verify_active = var.origin_verify_active_slot == "a" ? random_password.origin_verify_a.result : random_password.origin_verify_b.result
  origin_verify_values = [random_password.origin_verify_a.result, random_password.origin_verify_b.result]
}

resource "aws_lb_listener_rule" "http_origin_verified" {
  count = var.alb_enforce_origin_header ? 1 : 0

  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    http_header {
      http_header_name = local.origin_verify_header
      values           = local.origin_verify_values
    }
  }
}

resource "aws_lb_listener_rule" "https_origin_verified" {
  count = var.alb_enforce_origin_header && local.api_origin_https ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    http_header {
      http_header_name = local.origin_verify_header
      values           = local.origin_verify_values
    }
  }
}
