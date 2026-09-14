# Stockora Enterprise — Data Import Wizard & Export Center

## 1. Import Wizard Flow

1. **Upload & Parse:** User uploads CSV/JSON dataset. Stockora scans headers without touching live data.
2. **Column Mapping:** Map spreadsheet headers to Stockora master properties (`sku`, `name`, `price`, etc.).
3. **Validation & Preview:** Detects missing required fields, duplicates, invalid numbers, generating valid/invalid counts.
4. **Batch Processing:** Safe transactional ingest with error reports.

## 2. Export Center & Security

* **Formula Injection Sanitization:** Spreadsheet formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped.
* **Asynchronous Jobs:** Large datasets are queued and generated in the background.
* **Expiring Tokens:** Download links automatically expire after 24 hours via TTL indexes.
