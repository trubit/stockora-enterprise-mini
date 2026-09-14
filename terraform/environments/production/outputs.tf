output "vpc_id" {
  description = "Production VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_name" {
  description = "Production EKS Cluster Name"
  value       = module.kubernetes_cluster.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Production EKS Cluster Endpoint"
  value       = module.kubernetes_cluster.cluster_endpoint
}

output "mongodb_endpoint" {
  description = "Production DocumentDB Cluster Endpoint"
  value       = module.database.mongodb_endpoint
}

output "redis_endpoint" {
  description = "Production Redis Primary Endpoint"
  value       = module.database.redis_primary_endpoint
}
