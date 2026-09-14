# Stockora Enterprise — Data Metrics Dictionary

| Metric Code | Metric Name | Category | Formula / Definition | Standard Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| `GROSS_SALES` | Gross Sales | Revenue | $\sum \text{Subtotals before discounts/taxes}$ | Periodic target |
| `NET_SALES` | Net Sales | Revenue | $\text{Gross Sales} - \text{Discounts} - \text{Refunds}$ | — |
| `GROSS_MARGIN_PCT`| Gross Margin % | Profitability | $((\text{Revenue} - \text{COGS}) / \text{Revenue}) \times 100$ | $\ge 35\%$ |
| `AOV` | Average Order Value | Sales | $\text{Revenue} / \text{Total Orders}$ | Upward trend |
| `INV_TURNOVER` | Inventory Turnover Ratio | Inventory | $\text{COGS} / \text{Average Inventory Value}$ | $2.0x - 4.5x$ |
| `STOCKOUT_RATE` | Stockout Rate % | Inventory | $(\text{Out of Stock SKUs} / \text{Total SKUs}) \times 100$ | $< 3\%$ |
| `RETENTION_RATE` | Customer Retention Rate | Customers | $(\text{Returning Customers} / \text{Total Customers}) \times 100$ | $\ge 60\%$ |
| `SUPPLIER_ONTIME`| Supplier On-Time Rate | Procurement | $(\text{On-Time Deliveries} / \text{Total POs}) \times 100$ | $\ge 92\%$ |
| `HEALTH_SCORE` | Business Health Score | Executive | Weighted sum across 7 key business pillars | $\ge 85 / 100$ |
