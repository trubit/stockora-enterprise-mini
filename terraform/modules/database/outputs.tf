output "mongodb_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = aws_docdb_cluster.main.endpoint
}

output "mongodb_port" {
  description = "DocumentDB port"
  value       = aws_docdb_cluster.main.port
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address for ElastiCache Redis"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Port for ElastiCache Redis"
  value       = aws_elasticache_replication_group.main.port
}
