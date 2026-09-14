variable "environment" {
  type        = string
  description = "Target deployment environment (development, staging, production)"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the Virtual Private Cloud"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to distribute subnets across"
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public load balancer subnets"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private Kubernetes compute and database subnets"
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "tags" {
  type        = map(string)
  description = "Resource tags applied to all networking resources"
  default     = {}
}
