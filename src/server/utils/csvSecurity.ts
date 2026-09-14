/**
 * CSV Security utility: Protects against spreadsheet formula injection (CSV Injection / DDE).
 * Any cell value starting with =, +, -, @, \t, \r is safely prepended with a single quote.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  let isTriggered = false;

  // If the cell begins with dangerous formula triggers, prefix with single quote
  if (FORMULA_TRIGGERS.some((char) => str.startsWith(char))) {
    str = `'${str}`;
    isTriggered = true;
  }

  // Escape quotes and wrap in quotes if containing comma, newline, quotes, or triggered by formula
  if (
    isTriggered ||
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateSafeCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) =>
    headers.map((header) => sanitizeCsvCell(row[header])).join(',')
  );

  return [headerLine, ...rowLines].join('\n');
}
