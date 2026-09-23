environment          = "production"
aws_region           = "us-east-1"
availability_zones   = ["us-east-1a", "us-east-1b"]
vpc_cidr             = "10.30.0.0/16"
nat_gateway_count    = 2
db_instance_class    = "db.t3.small"
db_multi_az          = true
db_backup_retention_days = 7
db_username          = "gai_admin"
ecs_cpu              = 512
ecs_memory           = 1024
ecs_desired_count    = 2

# GitHub — adjust to your org/user
github_org            = "jwssIncp"
github_repo           = "GAI"
github_branch_deploy  = "main"

# Optional custom domain (leave empty to use *.cloudfront.net)
domain_name   = ""
hosted_zone_id = ""
