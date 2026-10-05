import { computePosition } from './position.js';
import { toRupeesString } from './money.js';

/**
 * Converts a JS Date (from Prisma DATE column) to a YYYY-MM-DD string using UTC
 * so IST (+5:30) never shifts the day.
 * @param {Date|string} val
 * @returns {string}
 */
export function toISODate(val) {
  const d = val instanceof Date ? val : new Date(val);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats a single installment row into the schedule entry shape.
 * Derives status relative to asOf.
 */
export function presentInstallment(inst, asOf) {
  const principalDue = inst.principalDuePaise;
  const interestDue = inst.interestDuePaise;
  const principalPaid = inst.principalPaidPaise;
  const interestPaid = inst.interestPaidPaise;

  const totalDue = principalDue + interestDue;
  const amountPaid = principalPaid + interestPaid;
  const remaining = totalDue - amountPaid;
  const dueDate = toISODate(inst.dueDate);

  let status;
  if (remaining === 0) {
    status = 'PAID';
  } else if (dueDate < asOf) {
    status = 'OVERDUE';
  } else if (amountPaid > 0) {
    status = 'PARTIAL';
  } else {
    status = 'UPCOMING';
  }

  return {
    number: inst.number,
    dueDate,
    principalDue: toRupeesString(principalDue),
    interestDue: toRupeesString(interestDue),
    totalDue: toRupeesString(totalDue),
    principalPaid: toRupeesString(principalPaid),
    interestPaid: toRupeesString(interestPaid),
    amountPaid: toRupeesString(amountPaid),
    remaining: toRupeesString(remaining),
    status,
  };
}

/**
 * Shapes a loan row + installment rows + asOf date into the full API response shape.
 * Pure: no DB calls, no HTTP.
 *
 * @param {Object} loanRow - Prisma Loan record
 * @param {Array} installmentRows - Prisma Installment records (ordered by number)
 * @param {string} asOf - ISO date string YYYY-MM-DD
 * @returns {{ loan, schedule, position }}
 */
export function presentLoan(loanRow, installmentRows, asOf) {
  const schedule = installmentRows.map((inst) => presentInstallment(inst, asOf));

  // Build shape that computePosition expects (pure paise integers)
  const posInstallments = installmentRows.map((inst) => ({
    number: inst.number,
    dueDate: toISODate(inst.dueDate),
    principalDuePaise: inst.principalDuePaise,
    interestDuePaise: inst.interestDuePaise,
    principalPaidPaise: inst.principalPaidPaise,
    interestPaidPaise: inst.interestPaidPaise,
  }));

  const pos = computePosition(posInstallments, asOf);

  return {
    loan: {
      id: loanRow.id,
      principal: toRupeesString(loanRow.principalPaise),
      annualRatePercent: Number(loanRow.annualRatePercent),
      tenureMonths: loanRow.tenureMonths,
      disbursementDate: toISODate(loanRow.disbursementDate),
      emi: toRupeesString(loanRow.emiPaise),
      createdAt: loanRow.createdAt.toISOString(),
    },
    schedule,
    position: {
      asOf,
      outstandingPrincipal: toRupeesString(pos.outstandingPrincipalPaise),
      outstandingTotal: toRupeesString(pos.outstandingTotalPaise),
      nextDue: pos.nextDue
        ? {
            number: pos.nextDue.number,
            dueDate: pos.nextDue.dueDate,
            amount: toRupeesString(pos.nextDue.amountPaise),
          }
        : null,
      overdueAmount: toRupeesString(pos.overdueAmountPaise),
      overdueInstallmentCount: pos.overdueInstallmentCount,
    },
  };
}
