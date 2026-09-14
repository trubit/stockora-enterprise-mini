# Customer Retention, RFM Scoring & Churn Intelligence

## Overview
Identifies customer lapse risks, computes RFM health scores, and recommends proactive retention actions.

### Churn Risk Levels
- **LOW** ($0 - 29$): Active, frequent orders.
- **MEDIUM** ($30 - 49$): Minor gap in purchasing activity.
- **HIGH** ($50 - 74$): Extended dormancy ($>60$ days) or single-order lapse.
- **CRITICAL** ($75 - 100$): Severe inactivity ($>120$ days) requiring immediate win-back campaigns.

### Next-Best-Action Engine
Evaluates customer value, tier status, and dormancy to suggest targeted interventions:
- `SEND_WIN_BACK_COUPON`
- `OFFER_LOYALTY_REWARD`
- `INVITE_TO_VIP`
- `SEND_REENGAGEMENT_REMINDER`
