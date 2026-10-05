const { ApiError } = require('./errors.js');

/**
 * Allocates a payment amount across loan repayment installments.
 * 
 * Allocation Rules:
 * 1. Oldest unsettled installment first (sorted by number ascending).
 * 2. Within each installment: interest is settled before principal.
 * 3. A partially paid installment continues from where it left off.
 * 4. If amount exceeds total outstanding balance across all installments, throws 422 AMOUNT_EXCEEDS_OUTSTANDING.
 * 5. Does not mutate input objects.
 * 
 * @param {number} amountPaise - Payment amount in integer paise
 * @param {Array<Object>} installments - Array of installment objects
 * @returns {{ allocations: Array<{ number: number, interestPaise: number, principalPaise: number }>, totalAppliedPaise: number }}
 */
function allocate(amountPaise, installments) {
  if (
    typeof amountPaise !== 'number' ||
    !Number.isInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Payment amount must be a positive integer in paise');
  }

  if (!Array.isArray(installments)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Installments must be an array');
  }

  // Calculate total outstanding balance across all installments before allocating
  let totalOutstandingPaise = 0;
  for (const inst of installments) {
    const principalDue = inst.principalDuePaise || 0;
    const interestDue = inst.interestDuePaise || 0;
    const principalPaid = inst.principalPaidPaise || 0;
    const interestPaid = inst.interestPaidPaise || 0;

    const remInterest = Math.max(0, interestDue - interestPaid);
    const remPrincipal = Math.max(0, principalDue - principalPaid);
    totalOutstandingPaise += (remInterest + remPrincipal);
  }

  // Reject overpayment beyond total debt with 422 BEFORE making any changes
  if (amountPaise > totalOutstandingPaise) {
    throw new ApiError(
      422,
      'AMOUNT_EXCEEDS_OUTSTANDING',
      `Payment amount (${amountPaise} paise) exceeds total outstanding balance (${totalOutstandingPaise} paise)`
    );
  }

  // Work on a sorted copy to guarantee oldest unsettled first without mutating input
  const sorted = [...installments].sort((a, b) => a.number - b.number);
  const allocations = [];
  let remainingToAllocate = amountPaise;

  for (const inst of sorted) {
    if (remainingToAllocate === 0) break;

    const principalDue = inst.principalDuePaise || 0;
    const interestDue = inst.interestDuePaise || 0;
    const principalPaid = inst.principalPaidPaise || 0;
    const interestPaid = inst.interestPaidPaise || 0;

    const remInterest = Math.max(0, interestDue - interestPaid);
    const remPrincipal = Math.max(0, principalDue - principalPaid);

    if (remInterest === 0 && remPrincipal === 0) {
      continue; // Installment is already fully settled
    }

    let interestAllocated = 0;
    let principalAllocated = 0;

    // 1. Pay remaining interest first
    if (remInterest > 0) {
      interestAllocated = Math.min(remainingToAllocate, remInterest);
      remainingToAllocate -= interestAllocated;
    }

    // 2. Pay remaining principal second
    if (remainingToAllocate > 0 && remPrincipal > 0) {
      principalAllocated = Math.min(remainingToAllocate, remPrincipal);
      remainingToAllocate -= principalAllocated;
    }

    // Only record if money was applied to this installment
    if (interestAllocated > 0 || principalAllocated > 0) {
      allocations.push({
        number: inst.number,
        interestPaise: interestAllocated,
        principalPaise: principalAllocated,
      });
    }
  }

  return {
    allocations,
    totalAppliedPaise: amountPaise - remainingToAllocate,
  };
}

module.exports = {
  allocate,
};
