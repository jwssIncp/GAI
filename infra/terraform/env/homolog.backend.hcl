# Replace YOUR_ACCOUNT_ID and bucket name after bootstrap apply.
bucket         = "gai-terraform-state-YOUR_ACCOUNT_ID"
key            = "gai/homolog/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "gai-terraform-locks"
encrypt        = true
