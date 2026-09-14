variable "environment" {
  type        = string
  description = "Target deployment environment"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes control plane version"
  default     = "1.29"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where the cluster will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for EKS node groups and internal communication"
}

variable "node_instance_types" {
  type        = list(string)
  description = "EC2 instance types for EKS worker nodes"
  default     = ["t3.medium"]
}

variable "desired_node_count" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 2
}

variable "min_node_count" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 2
}

variable "max_node_count" {
  type        = number
  description = "Maximum number of worker nodes for auto-scaling"
  default     = 6
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default     = {}
}
