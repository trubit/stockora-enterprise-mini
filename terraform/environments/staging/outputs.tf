output "vpc_id" {
  description = "Staging VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_name" {
  description = "Staging EKS Cluster Name"
  value       = module.kubernetes_cluster.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Staging EKS Cluster Endpoint"
  value       = module.kubernetes_cluster.cluster_endpoint
}

output "mongodb_endpoint" {
  description = "Staging DocumentDB Cluster Endpoint"
  value       = module.database.mongodb_endpoint
}

output "redis_endpoint" {
  description = "Staging Redis Primary Endpoint"
  value       = module.database.redis_primary_endpoint
}
