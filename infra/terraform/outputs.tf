output "environment" {
  value = var.environment
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "ecs_task_definition_family" {
  value = aws_ecs_task_definition.backend.family
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "assets_bucket_name" {
  value = aws_s3_bucket.assets.bucket
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "app_url" {
  value = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}
