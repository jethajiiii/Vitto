const { ApiError } = require('./errors.js');
const { isValidISODate } = require('./dates.js');

/**
 * Computes the current financial position of a loan as of a specific date.
 * 
 * Position Calculations:
 * - Outstanding Principal: Sum of remaining principal across all installments.
 * - Outstanding Total: Sum of remaining principal and remaining interest across all installments.
 * - Overdue Amount: Sum of remaining balances on installments with dueDate strictly before asOf.
 * - Overdue Count: Number of distinct installments that are overdue.
 * - Next Due: The earliest unsettled installment with dueDate on or after asOf (reporting remaining balance).
 * 
 * @param {Array<Object>} installments - Array of installment objects
 * @param {string} asOf - ISO date string "YYYY-MM-DD"
 * @returns {{
 *   outstandingPrincipalPaise: number,
 *   outstandingTotalPaise: number,
 *   nextDue: { number: number, dueDate: string, amountPaise: number } | null,
 *   overdueAmountPaise: number,
 *   overdueInstallmentCount: number
 * }}
 */
function computePosition(installments, asOf) {
  if (!isValidISODate(asOf)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid asOf date: ${asOf}`);
  }

  if (!Array.isArray(installments)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Installments must be an array');
  }

  const sorted = [...installments].sort((a, b) => a.number - b.number);

  let outstandingPrincipalPaise = 0;
  let outstandingTotalPaise = 0;
  let overdueAmountPaise = 0;
  let overdueInstallmentCount = 0;
  let nextDue = null;

  for (const inst of sorted) {
    const principalDue = inst.principalDuePaise || 0;
    const interestDue = inst.interestDuePaise || 0;
    const principalPaid = inst.principalPaidPaise || 0;
    const interestPaid = inst.interestPaidPaise || 0;

    const remainingPrincipal = Math.max(0, principalDue - principalPaid);
    const remainingInterest = Math.max(0, interestDue - interestPaid);
    const remainingTotal = remainingPrincipal + remainingInterest;

    outstandingPrincipalPaise += remainingPrincipal;
    outstandingTotalPaise += remainingTotal;

    if (remainingTotal > 0) {
      // Overdue check: dueDate strictly before asOf
      if (inst.dueDate < asOf) {
        overdueAmountPaise += remainingTotal;
        overdueInstallmentCount += 1;
      } else if (!nextDue && inst.dueDate >= asOf) {
        // Next due: earliest unsettled installment due on or after asOf
        nextDue = {
          number: inst.number,
          dueDate: inst.dueDate,
          amountPaise: remainingTotal,
        };
      }
    }
  }

  if (outstandingTotalPaise === 0) {
    return {
      outstandingPrincipalPaise: 0,
      outstandingTotalPaise: 0,
      nextDue: null,
      overdueAmountPaise: 0,
      overdueInstallmentCount: 0,
    };
  }

  return {
    outstandingPrincipalPaise,
    outstandingTotalPaise,
    nextDue,
    overdueAmountPaise,
    overdueInstallmentCount,
  };
}

module.exports = {
  computePosition,
};
