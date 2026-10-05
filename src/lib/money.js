const { ApiError } = require('./errors.js');

/**
 * Converts a number or numeric string to integer paise without float multiplication.
 * Splits on "." to avoid float inaccuracies (e.g. 19.99 * 100 = 1998.9999...).
 * @param {number|string} input 
 * @returns {number} Integer paise
 */
function toPaise(input) {
  if (input === null || input === undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Amount is required');
  }

  const str = String(input).trim();
  if (str === '' || !/^-?\d+(\.\d+)?$/.test(str)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid numeric amount');
  }

  const num = Number(str);
  if (!Number.isFinite(num)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Amount must be finite');
  }

  if (num < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Amount cannot be negative');
  }

  const parts = str.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  if (decimalPart.length > 2) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Amount cannot have more than 2 decimal places');
  }

  const paddedDecimal = decimalPart.padEnd(2, '0');
  return parseInt(integerPart, 10) * 100 + parseInt(paddedDecimal, 10);
}

/**
 * Formats integer paise as "9984.61" string for API responses.
 * @param {number} paise 
 * @returns {string}
 */
function toRupeesString(paise) {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Paise must be an integer');
  }
  const rupees = Math.floor(paise / 100);
  const cents = Math.abs(paise % 100);
  return `${rupees}.${String(cents).padStart(2, '0')}`;
}

/**
 * Formats integer paise as "₹9,984.61" using en-IN currency formatting.
 * @param {number} paise 
 * @returns {string}
 */
function formatINR(paise) {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Paise must be an integer');
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

module.exports = {
  toPaise,
  toRupeesString,
  formatINR,
};
