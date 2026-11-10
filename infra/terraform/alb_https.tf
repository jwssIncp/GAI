# TLS between CloudFront and the ALB (opt-in).
#
# Enable by setting api_origin_domain_name (e.g. "api-origin.example.com") in a
# Route53 zone given by hosted_zone_id. This creates a regional ACM certificate,
# an alias record to the ALB, an HTTPS:443 listener and switches the CloudFront
# API origin to https-only. Rollout in two applies:
#   1) api_origin_domain_name = "...", alb_http_origin_enabled = true
#   2) after CloudFront finished deploying, alb_http_origin_enabled = false
# Without api_origin_domain_name nothing changes (HTTP origin, as before).

moved {
  from = aws_vpc_security_group_ingress_rule.alb_http_from_cloudfront
  to   = aws_vpc_security_group_ingress_rule.alb_http_from_cloudfront[0]
}

resource "aws_acm_certificate" "api_origin" {
  count = local.api_origin_https ? 1 : 0

  domain_name       = var.api_origin_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-api-origin"
  }
}

resource "aws_route53_record" "api_origin_validation" {
  for_each = local.api_origin_https ? {
    for dvo in aws_acm_certificate.api_origin[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

resource "aws_acm_certificate_validation" "api_origin" {
  count = local.api_origin_https ? 1 : 0

  certificate_arn         = aws_acm_certificate.api_origin[0].arn
  validation_record_fqdns = [for record in aws_route53_record.api_origin_validation : record.fqdn]
}

resource "aws_route53_record" "api_origin" {
  count = local.api_origin_https ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = var.api_origin_domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

resource "aws_lb_listener" "https" {
  count = local.api_origin_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api_origin[0].certificate_arn

  default_action {
    type             = var.alb_enforce_origin_header ? "fixed-response" : "forward"
    target_group_arn = var.alb_enforce_origin_header ? null : aws_lb_target_group.backend.arn

    dynamic "fixed_response" {
      for_each = var.alb_enforce_origin_header ? [1] : []
      content {
        content_type = "application/json"
        message_body = jsonencode({ code = "FORBIDDEN", message = "Direct origin access is not allowed" })
        status_code  = "403"
      }
    }
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https_from_cloudfront" {
  count = local.api_origin_https ? 1 : 0

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from CloudFront"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}
