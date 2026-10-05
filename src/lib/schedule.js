const { ApiError } = require('./errors.js');
const { isValidISODate, addMonthsClamped } = require('./dates.js');

/**
 * Generates the full loan repayment schedule given loan parameters.
 * Calculates Equal Monthly Instalment (EMI) and allocates principal/interest per month.
 * The final instalment absorbs any rounding remainder to ensure exact principal payoff.
 * 
 * @param {Object} params
 * @param {number} params.principalPaise - Total principal in paise (e.g. 20000000 for ₹2,00,000)
 * @param {number} params.annualRatePercent - Annual interest rate (e.g. 18.0)
 * @param {number} params.tenureMonths - Loan tenure in months (e.g. 24)
 * @param {string} params.disbursementDate - Disbursement date in YYYY-MM-DD format
 * @returns {{ emiPaise: number, installments: Array<{ number: number, dueDate: string, principalDuePaise: number, interestDuePaise: number, totalDuePaise: number }> }}
 */
function generateSchedule({ principalPaise, annualRatePercent, tenureMonths, disbursementDate }) {
  if (
    typeof principalPaise !== 'number' ||
    !Number.isInteger(principalPaise) ||
    principalPaise <= 0
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Principal must be a positive integer in paise');
  }

  if (
    typeof annualRatePercent !== 'number' ||
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Annual interest rate must be a non-negative number');
  }

  if (
    typeof tenureMonths !== 'number' ||
    !Number.isInteger(tenureMonths) ||
    tenureMonths <= 0
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tenure months must be a positive integer');
  }

  if (!isValidISODate(disbursementDate)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Disbursement date must be a valid ISO date string (YYYY-MM-DD)');
  }

  const P = principalPaise;
  const n = tenureMonths;
  const r = annualRatePercent / 12 / 100;

  // Calculate EMI in integer paise
  let emiPaise;
  if (r === 0) {
    emiPaise = Math.round(P / n);
  } else {
    const factor = Math.pow(1 + r, n);
    emiPaise = Math.round((P * r * factor) / (factor - 1));
  }

  let balance = P;
  const installments = [];

  for (let i = 1; i <= n; i++) {
    // Monthly interest component rounded to nearest paise
    const interestDuePaise = Math.round(balance * r);

    // Final instalment absorbs remainder to guarantee exact principal payoff
    const principalDuePaise = (i === n) ? balance : (emiPaise - interestDuePaise);
    const totalDuePaise = principalDuePaise + interestDuePaise;

    balance -= principalDuePaise;

    // Due date calculated relative to original disbursement date to prevent day drift
    const dueDate = addMonthsClamped(disbursementDate, i);

    installments.push({
      number: i,
      dueDate,
      principalDuePaise,
      interestDuePaise,
      totalDuePaise,
    });
  }

  return {
    emiPaise,
    installments,
  };
}

module.exports = {
  generateSchedule,
};
