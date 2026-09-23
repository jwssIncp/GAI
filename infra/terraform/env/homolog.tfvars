environment          = "homolog"
aws_region           = "us-east-1"
availability_zones   = ["us-east-1a", "us-east-1b"]
vpc_cidr             = "10.20.0.0/16"
nat_gateway_count    = 1
db_instance_class    = "db.t3.micro"
db_multi_az          = false
db_backup_retention_days = 1
db_username          = "gai_admin"
ecs_cpu              = 256
ecs_memory           = 512
ecs_desired_count    = 1

# GitHub — adjust to your org/user
github_org            = "jwssIncp"
github_repo           = "GAI"
github_branch_deploy  = "develop"

# Optional custom domain (leave empty to use *.cloudfront.net)
domain_name   = ""
hosted_zone_id = ""
