resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production"

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.name_prefix}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = {
    Name = "${local.name_prefix}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # With origin enforcement only the listener rule (origin_protection.tf)
  # forwards; anything without the CloudFront secret header gets 403.
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
