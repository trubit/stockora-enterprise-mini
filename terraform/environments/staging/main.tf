# Stockora Enterprise — Staging Infrastructure

module "networking" {
  source = "../../modules/networking"

  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "kubernetes_cluster" {
  source = "../../modules/kubernetes_cluster"

  environment         = var.environment
  cluster_version     = var.cluster_version
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  node_instance_types = var.node_instance_types
  desired_node_count  = var.desired_node_count
  min_node_count      = var.min_node_count
  max_node_count      = var.max_node_count
}

module "database" {
  source = "../../modules/database"

  environment            = var.environment
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  eks_security_group_id  = module.kubernetes_cluster.cluster_security_group_id
  mongodb_admin_username = var.mongodb_admin_username
  mongodb_admin_password = var.mongodb_admin_password
  mongodb_instance_class = var.mongodb_instance_class
  mongodb_instance_count = var.mongodb_instance_count
  redis_node_type        = var.redis_node_type
  redis_auth_token       = var.redis_auth_token
}
