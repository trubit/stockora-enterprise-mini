variable "aws_region" {
  type        = string
  description = "Target AWS Region"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment identifier"
  default     = "development"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.10.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Target availability zones"
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs"
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs"
  default     = ["10.10.10.0/24", "10.10.20.0/24"]
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes control plane version"
  default     = "1.29"
}

variable "node_instance_types" {
  type        = list(string)
  description = "EKS worker node instance types"
  default     = ["t3.small"]
}

variable "desired_node_count" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 1
}

variable "min_node_count" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 1
}

variable "max_node_count" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 2
}

variable "mongodb_admin_username" {
  type        = string
  description = "DocumentDB admin username"
  default     = "stockora_dev_admin"
}

variable "mongodb_admin_password" {
  type        = string
  description = "DocumentDB admin password"
  sensitive   = true
}

variable "mongodb_instance_class" {
  type        = string
  description = "DocumentDB instance class"
  default     = "db.t4g.medium"
}

variable "mongodb_instance_count" {
  type        = number
  description = "DocumentDB instance count"
  default     = 1
}

variable "redis_node_type" {
  type        = string
  description = "Redis cluster node type"
  default     = "cache.t4g.micro"
}

variable "redis_auth_token" {
  type        = string
  description = "Redis AUTH token"
  sensitive   = true
}
