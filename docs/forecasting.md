# Stockora Enterprise — AI Forecasting & Decision Intelligence

## 1. Multi-Horizon Forecasting Engine

The forecasting engine utilizes autoregressive time-series analysis and historical variance weighting to project sales, demand, inventory needs, and cash flow across 14, 30, and 90-day horizons.

### Visualization & Confidence Bands
Every forecast renders three distinct streams:
- **Historical Actuals**: Actual transactions recorded in MongoDB.
- **Forecast Point (p50)**: Median statistical projection.
- **Confidence Range (p10 / p90)**: Lower floor (p10) and upper ceiling (p90) confidence bounds.

---

## 2. What-If Decision Simulators

Stockora Decision Intelligence allows executives to test hypotheses without mutating live production state:

### Price Elasticity Simulator
- Simulates $\pm 5\%, \pm 10\%, \pm 15\%$ price adjustments.
- Calibrates demand impact using historical category elasticity coefficients (default $-1.2$).
- Outputs estimated volume change, gross revenue impact, and resulting gross margin %.

### Inventory Reorder Simulator
- Simulates ordering $N$ additional units from primary suppliers.
- Computes capital tied up, projected days of stock coverage, and reduction in stockout probability.

### Supplier Comparison Simulator
- Performs multi-criteria decision analysis comparing Supplier A vs Supplier B on unit price, lead time, defect rate, and historical reliability rating.

---

## 3. Daily AI Executive Morning Briefing
Generated automatically every morning at 06:00:
- Synthesizes yesterday's financial achievements and growth percentages.
- Highlights critical inventory stockouts and estimated lost sales value.
- Recommends 3 immediate, high-priority managerial action items.
