variable "environment" {
  type        = string
  description = "Target deployment environment"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where the database and cache will reside"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for database and cache subnet groups"
}

variable "eks_security_group_id" {
  type        = string
  description = "Security group ID of the EKS cluster permitted to access database and cache"
}

variable "mongodb_admin_username" {
  type        = string
  description = "Master username for DocumentDB/MongoDB"
  default     = "stockora_admin"
}

variable "mongodb_admin_password" {
  type        = string
  description = "Master password for DocumentDB/MongoDB"
  sensitive   = true
}

variable "mongodb_instance_class" {
  type        = string
  description = "DocumentDB compute instance class"
  default     = "db.t4g.medium"
}

variable "mongodb_instance_count" {
  type        = number
  description = "Number of DocumentDB instances in cluster"
  default     = 2
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.t4g.micro"
}

variable "redis_auth_token" {
  type        = string
  description = "Auth token / password for Redis cluster"
  sensitive   = true
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default     = {}
}
