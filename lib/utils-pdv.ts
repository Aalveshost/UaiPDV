/**
 * Utilities for PDV logic and formatting
 */

/**
 * Formats a number to Brazilian Real (BRL)
 */
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Generates a clean sequential display ID for orders.
 * It uses localStorage to persist the counter across refreshes.
 */
export const generateDisplayId = async (): Promise<string> => {
  const currentCounter = localStorage.getItem('maktub_order_counter') || '0';
  const nextCounter = parseInt(currentCounter) + 1;
  localStorage.setItem('maktub_order_counter', nextCounter.toString());
  
  // Pad with zeros (e.g., 001, 042, 125)
  return `#${nextCounter.toString().padStart(3, '0')}`;
};

/**
 * Resets the order counter to zero.
 */
export const resetOrderCounter = () => {
  localStorage.setItem('maktub_order_counter', '0');
};

/**
 * Calculates change for cash payments
 */
export const calculateChange = (received: number, total: number) => {
  const change = received - total;
  return change > 0 ? change : 0;
};

/**
 * Generates a simple UUID-like string
 */
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
