# Stockora Enterprise — Business Intelligence Engine

## Methodology & Calculation Standards

### 1. Revenue & Sales Aggregations
- **Gross Sales**: Sum of checkout subtotal amounts before discounts and taxes.
- **Discounts**: Total promotional discounts, coupon deductions, and manual price reductions.
- **Returns / Refunds**: Value of returned items and completed refund disbursements.
- **Net Sales**: $\text{Gross Sales} - \text{Discounts} - \text{Returns}$.
- **Tax**: Sales tax collected on taxable transaction lines.
- **Total Revenue**: $\text{Net Sales} + \text{Tax}$.

### 2. Profitability & COGS
- **COGS (Cost of Goods Sold)**: Aggregated unit cost $\times$ quantity sold for transactions where catalog cost data is verified.
- **Gross Profit**: $\text{Revenue} - \text{COGS}$.
- **Gross Margin %**: $(\text{Gross Profit} / \text{Revenue}) \times 100$.
- *Safety Rule*: If cost price data is not registered on product lines, profitability is explicitly labeled `unavailable` rather than fabricated.

### 3. Product Performance Matrix (BCG Matrix)
Classifies catalog products into four distinct strategic quadrants:
- **⭐ Stars**: High sales volume ($\ge 100$ units/mo) and high gross margin ($\ge 30\%$).
- **🐄 Cash Cows**: High sales volume ($\ge 100$ units/mo) and moderate/low gross margin ($< 30\%$).
- **❓ Question Marks**: Low sales volume ($< 100$ units/mo) and high gross margin ($\ge 30\%$).
- **🐕 Dogs**: Low sales volume ($< 100$ units/mo) and low gross margin ($< 30\%$).

### 4. Customer Cohort Analysis
Groups customers by their month of initial acquisition and tracks repeat purchase activity across successive calendar months ($M_0, M_1, M_2, \dots, M_5$) to determine true lifetime retention and churn decay.

### 5. Business Health Score (0–100)
Transparent weighted multi-factor formula:
$$\text{Score} = \text{Sales (20)} + \text{Profitability (20)} + \text{Inventory (15)} + \text{Retention (15)} + \text{Procurement (10)} + \text{Cash (10)} + \text{Operations (10)}$$
