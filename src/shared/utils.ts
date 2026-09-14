/**
 * Formats a numeric value into a standard currency string.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Validates whether a barcode string matches standard formats (UPC-A, EAN-13, or alphanumeric).
 */
export function isValidBarcode(barcode: string): boolean {
  if (!barcode || barcode.trim() === '') return false;
  // Simple check for numeric/alphanumeric code sequences between 8 and 14 chars
  const regex = /^[a-zA-Z0-9]{8,14}$/;
  return regex.test(barcode);
}

/**
 * Capitalizes the first letter of each word in a string.
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}
