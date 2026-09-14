# SaaS Subscription Plans Catalog

## 1. Plan Structure & Tiers

Stockora Enterprise provides 5 standard subscription tiers:

1. **Free Starter (`FREE`)**: ₦0/mo. For solo operators and evaluation. Includes 2 users, 1 branch, 1 warehouse, 1 POS terminal, and 100 products.
2. **Starter Plan (`STARTER`)**: ₦15,000/mo ($25/mo). For small retail stores. Includes 5 users, 1 branch, 1 warehouse, 2 POS terminals, and 1,000 products. 14-day trial included.
3. **Professional Plan (`PROFESSIONAL`)**: ₦45,000/mo ($75/mo). For growing multi-branch retailers. Includes 20 users, 5 branches, 3 warehouses, 10 POS terminals, 10,000 products, CRM, Loyalty, and Copilot AI.
4. **Business Enterprise (`BUSINESS`)**: ₦120,000/mo ($199/mo). For high-volume multi-warehouse operations. Includes 100 users, 20 branches, 10 warehouses, 50 POS terminals, 50,000 products, REST API, automations, and custom branding.
5. **Enterprise Unlimited (`ENTERPRISE`)**: ₦350,000/mo ($599/mo). Explicitly unlimited limits for all resources (`unlimited: true`), dedicated account management, and custom SLAs.

---

## 2. Plan Versioning & Immutable Snapshots

To prevent breaking existing subscribers when an administrator updates a plan's price or limits:
- Each plan maintains an integer `version` field.
- When a tenant subscribes or renews, a full `planSnapshot` is recorded directly inside the `Subscription` and `BillingInvoice` records.
- Historical invoices always reflect the snapshot captured at the time of issuance.
