# Tenant Onboarding & Employee Invitation Workflow

## 1. 8-Step SaaS Onboarding Wizard

The onboarding wizard guides new enterprises through complete setup in under 3 minutes:

1. **Company Profile**: Legal entity name, trade name, tax registration number, support email, and phone.
2. **Business Model**: Retail, Wholesale, Manufacturing, Services, Franchise, Omnichannel.
3. **Localization & Currency**: Base currency code, currency symbol, timezone, fiscal year start month.
4. **Primary Branch**: Flagship location name, branch code, address, contact details.
5. **Initial Warehouse**: Default receiving and storage facility, warehouse code, aisle configurations.
6. **POS Terminal**: Register terminal name, hardware receipt printer mode, cash drawer bindings.
7. **Team Invitations**: Bulk email invite dispatch for Store Managers, Cashiers, and Accountants.
8. **Review & Launch**: Summary review, slug generation confirmation, and instant dashboard launch.

## 2. Tokenized Team Invitations

- **Security**: Cryptographically generated 64-character random hex token (`crypto.randomBytes(32).toString('hex')`).
- **Expiration**: Standard 7-day TTL (`expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`).
- **Single-Use Verification**: Once accepted, state updates to `ACCEPTED`, and tenant membership is linked to the employee's user ID.
- **Revocation**: Company owners can revoke pending invitations at any time before acceptance.
