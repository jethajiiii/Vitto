const MONTH_NAMES = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

/**
 * Formats a rupee string or number into Indian Rupee grouping (en-IN) with 2 decimals.
 * Performs NO money arithmetic.
 *
 * @param {string|number} rupeeVal - e.g. "200000.00" or 9984.82
 * @returns {string} - e.g. "2,00,000.00"
 */
export function formatINR(rupeeVal) {
  if (rupeeVal === null || rupeeVal === undefined || rupeeVal === '') {
    return '0.00';
  }
  const num = typeof rupeeVal === 'number' ? rupeeVal : parseFloat(rupeeVal);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats an ISO date string ("YYYY-MM-DD") to "DD MMM YYYY" (e.g. "15 Jul 2026").
 * Uses string parsing ONLY (no Date objects) to eliminate timezone shifts.
 *
 * @param {string} isoDate - e.g. "2026-07-15"
 * @returns {string} - e.g. "15 Jul 2026"
 */
export function formatDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate || '';
  }
  const [year, month, day] = isoDate.split('-');
  const dayNum = parseInt(day, 10);
  const monthName = MONTH_NAMES[month] || month;
  return `${dayNum} ${monthName} ${year}`;
}

/**
 * Returns today's ISO date string ("YYYY-MM-DD") in Asia/Kolkata (IST) timezone.
 *
 * @returns {string} - e.g. "2026-10-05"
 */
export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
