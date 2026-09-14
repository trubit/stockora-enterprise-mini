# Stockora Enterprise — Reports & Exports Engine

## Standard Reports Supported
1. **Sales Performance Report**: Breakdown by date, shift, cashier, channel, and payment method.
2. **Inventory Valuation & Velocity Report**: Healthy, low, critical, and dead stock valuations.
3. **Procurement & Supplier Report**: Purchase order statuses, vendor lead times, and defect rates.
4. **Customer Cohort Retention Report**: Retention heatmap matrices and lifetime customer values.
5. **Cash Register Variance Audit Report**: Terminal opening/closing counts and discrepancies.

## Queue & Export Processing
Large reports and exports are queued via **BullMQ** to prevent memory spikes in the Node.js runtime. Smaller reports stream directly as CSV or formatted JSON.
