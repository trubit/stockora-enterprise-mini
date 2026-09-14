# Customer 360 & Unified Profile Architecture

## Overview
Customer 360 consolidates demographic, transactional, behavioral, loyalty, and communication data into a single unified profile.

### Profile Attributes
- **Contact & Identification**: Code, Name, Email, Phone, Addresses, Group, Customer Type (`RETAIL`, `WHOLESALE`, `B2B`, `VIP`).
- **Financial Metrics**: Total Spending, Total Orders, Average Order Value (AOV), Return Count, Refunds Total.
- **Lifetime Value (CLV)**: Documented formula $\text{CLV} = \text{AOV} \times \text{Orders/Yr} \times \text{Gross Margin} \times \text{Retention Factor}$.
- **Loyalty Wallet**: Current Tier (`BRONZE`, `SILVER`, `GOLD`, `PLATINUM`), Available Points, Tier Multiplier, Points History.
- **Chronological Timeline**: Ordered event stream logging Account Creation, Orders, Payments, Returns, Reward Redemptions, and Campaigns.
