# Loyalty Program, Tiers, Rewards & Anti-Fraud

## Overview
Stockora Enterprise features an integrated, tiered loyalty points and rewards catalog system.

### Tier Structure & Earning Multipliers
| Tier | Minimum Points | Points Earning Multiplier |
|---|---|---|
| **BRONZE** | 0 | 1.0x (1 pt per $10) |
| **SILVER** | 500 | 1.25x |
| **GOLD** | 2,000 | 1.5x |
| **PLATINUM** | 5,000 | 2.0x |

### Atomic Reward Redemptions
- Validates point balances and tier eligibility before executing deductions.
- Generates a unique, single-use voucher code with an expiration window.
- Emits atomic rollback on transactional failures.

### Anti-Fraud & Referral Checks
- Prohibits self-referral (matching email addresses).
- Scans for excessive 24-hour redemptions and abnormal point accruals.
