variable "aws_region" {
  type        = string
  description = "Target AWS Region"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment identifier"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.100.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Target availability zones"
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs"
  default     = ["10.100.1.0/24", "10.100.2.0/24", "10.100.3.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs"
  default     = ["10.100.10.0/24", "10.100.20.0/24", "10.100.30.0/24"]
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes control plane version"
  default     = "1.29"
}

variable "node_instance_types" {
  type        = list(string)
  description = "EKS worker node instance types"
  default     = ["m6i.large", "t3.xlarge"]
}

variable "desired_node_count" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 3
}

variable "min_node_count" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 3
}

variable "max_node_count" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 10
}

variable "mongodb_admin_username" {
  type        = string
  description = "DocumentDB admin username"
  default     = "stockora_prod_admin"
}

variable "mongodb_admin_password" {
  type        = string
  description = "DocumentDB admin password (must be passed via secure env var TF_VAR_mongodb_admin_password)"
  sensitive   = true
}

variable "mongodb_instance_class" {
  type        = string
  description = "DocumentDB instance class"
  default     = "db.r6g.large"
}

variable "mongodb_instance_count" {
  type        = number
  description = "DocumentDB instance count for multi-AZ high availability"
  default     = 3
}

variable "redis_node_type" {
  type        = string
  description = "Redis cluster node type"
  default     = "cache.m6g.large"
}

variable "redis_auth_token" {
  type        = string
  description = "Redis AUTH token (must be passed via secure env var TF_VAR_redis_auth_token)"
  sensitive   = true
}
