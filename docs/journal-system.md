# Double-Entry Journal System & Posting Engine

## Overview
Every financial modification in Stockora Enterprise is recorded via balanced double-entry journal entries.

### Validation Rules
1. **Mathematical Balance**: $\sum \text{Debits} == \sum \text{Credits}$ up to 2 decimal places precision.
2. **Account Code Resolution**: All account codes referenced in journal lines must exist in the active tenant's Chart of Accounts.
3. **Period Locking**: Rejects direct postings if the journal date falls within a closed fiscal period.

### Reversal Mechanism
To modify or correct an existing posted journal entry:
1. An offsetting reversal journal is generated (swapping debit and credit lines) with entry code `REV-JE-XXXX`.
2. The original journal is marked `status: 'REVERSED'` and references `reversedByEntryId`.
3. Account balances are adjusted symmetrically, preserving the complete audit history.
