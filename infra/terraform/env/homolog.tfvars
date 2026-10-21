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
enable_db_bastion    = false

# Paliativo DBeaver (homolog only — never enable in production.tfvars):
# 1) Cada pessoa: curl -s https://ifconfig.me   → use /32
# 2) Preencha db_allowed_cidrs
# 3) db_publicly_accessible = true
# 4) Infra apply + Deploy Homolog (cria usuário gai_admin_ops)
db_publicly_accessible = true
db_allowed_cidrs       = [
  "187.102.30.28/32",  # Luiz
]
db_operator_username   = "gai_admin_ops"
# One-shot: forces RDS destroy/create (AWS same-VPC subnet limit). Set false after apply.
db_force_replace       = true

# GitHub — adjust to your org/user
github_org            = "jwssIncp"
github_repo           = "GAI"
github_branch_deploy  = "develop"

# Optional custom domain (leave empty to use *.cloudfront.net)
domain_name   = ""
hosted_zone_id = ""
