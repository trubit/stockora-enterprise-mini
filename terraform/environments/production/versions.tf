terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }

  # Production remote backend configuration template (S3 + DynamoDB state locking)
  # backend "s3" {
  #   bucket         = "stockora-enterprise-tfstate-production"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "stockora-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Stockora Enterprise"
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}
