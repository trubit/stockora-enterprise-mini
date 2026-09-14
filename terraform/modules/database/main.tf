# Stockora Enterprise — Database & Cache Module (DocumentDB + ElastiCache Redis)

# Security Group for DocumentDB (MongoDB compatible)
resource "aws_security_group" "docdb" {
  name        = "stockora-${var.environment}-docdb-sg"
  description = "Controls access to DocumentDB cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "MongoDB wire protocol from EKS cluster nodes"
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-docdb-sg"
    Environment = var.environment
  })
}

# DocumentDB Subnet Group
resource "aws_docdb_subnet_group" "main" {
  name       = "stockora-${var.environment}-docdb-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-docdb-subnet-group"
    Environment = var.environment
  })
}

# DocumentDB Cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier      = "stockora-${var.environment}-docdb"
  engine                  = "docdb"
  master_username         = var.mongodb_admin_username
  master_password         = var.mongodb_admin_password
  backup_retention_period = 7
  preferred_backup_window = "02:00-03:00"
  skip_final_snapshot     = var.environment != "production"
  db_subnet_group_name    = aws_docdb_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.docdb.id]
  storage_encrypted       = true

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-docdb-cluster"
    Environment = var.environment
  })
}

# DocumentDB Instances
resource "aws_docdb_cluster_instance" "cluster_instances" {
  count              = var.mongodb_instance_count
  identifier         = "stockora-${var.environment}-docdb-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.mongodb_instance_class

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-docdb-instance-${count.index + 1}"
    Environment = var.environment
  })
}

# Security Group for Redis
resource "aws_security_group" "redis" {
  name        = "stockora-${var.environment}-redis-sg"
  description = "Controls access to ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis port from EKS cluster nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-redis-sg"
    Environment = var.environment
  })
}

# Redis Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "stockora-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-redis-subnet-group"
    Environment = var.environment
  })
}

# Redis Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "stockora-${var.environment}-redis"
  description                = "Stockora ${var.environment} Redis cache and pub/sub cluster"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "production" ? 2 : 1
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  automatic_failover_enabled = var.environment == "production"

  tags = merge(var.tags, {
    Name        = "stockora-${var.environment}-redis"
    Environment = var.environment
  })
}
