output "vpc_id" {
  description = "Development VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_name" {
  description = "Development EKS Cluster Name"
  value       = module.kubernetes_cluster.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Development EKS Cluster Endpoint"
  value       = module.kubernetes_cluster.cluster_endpoint
}

output "mongodb_endpoint" {
  description = "Development DocumentDB Cluster Endpoint"
  value       = module.database.mongodb_endpoint
}

output "redis_endpoint" {
  description = "Development Redis Primary Endpoint"
  value       = module.database.redis_primary_endpoint
}
