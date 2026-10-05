const { ApiError } = require('./errors.js');

/**
 * Validates whether a string is a strict YYYY-MM-DD calendar date.
 * Rejects invalid dates such as "2026-02-30".
 * @param {string} str 
 * @returns {boolean}
 */
function isValidISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [y, m, d] = str.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Adds n months to an ISO date string ("YYYY-MM-DD"), clamping to the target month's maximum day.
 * Always computed relative to the original base date to prevent day-of-month drift across months.
 * @param {string} isoDate - Base date string "YYYY-MM-DD"
 * @param {number} n - Number of months to add
 * @returns {string} - Clamped ISO date string "YYYY-MM-DD"
 */
function addMonthsClamped(isoDate, n) {
  if (!isValidISODate(isoDate)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ISO date: ${isoDate}`);
  }

  const [y, m, d] = isoDate.split('-').map(Number);
  
  // Calculate target month (0-indexed) and year
  const totalMonths = (m - 1) + n;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // 0-11

  // Find max days in target month using UTC to avoid timezone issues
  // Day 0 of month (targetMonth + 1) gives last day of targetMonth
  const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(d, maxDays);

  const formattedYear = String(targetYear).padStart(4, '0');
  const formattedMonth = String(targetMonth + 1).padStart(2, '0');
  const formattedDay = String(targetDay).padStart(2, '0');

  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
}

module.exports = {
  isValidISODate,
  addMonthsClamped,
};
