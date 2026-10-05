import db from '../db.js';
import { generateSchedule } from '../schedule.js';
import { isUuid } from '../validation.js';
import { presentLoan, toISODate } from '../presenters.js';
import { ApiError } from '../errors.js';

/**
 * Creates a loan and its full installment schedule in one transaction.
 * Dates are written at UTC midnight to avoid timezone drift.
 *
 * @param {{ principalPaise, annualRatePercent, tenureMonths, disbursementDate }} validated
 * @returns {Object} Full loan view (same shape as getLoan)
 */
export async function createLoan({ principalPaise, annualRatePercent, tenureMonths, disbursementDate }) {
  const schedule = generateSchedule({
    principalPaise,
    annualRatePercent,
    tenureMonths,
    disbursementDate,
  });

  // Convert YYYY-MM-DD ISO strings to Date at UTC midnight for Prisma DATE columns
  const toUTCDate = (iso) => new Date(`${iso}T00:00:00.000Z`);

  const loan = await db.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        principalPaise,
        annualRatePercent,
        tenureMonths,
        disbursementDate: toUTCDate(disbursementDate),
        emiPaise: schedule.emiPaise,
      },
    });

    // Bulk-create all installments in one statement
    await tx.installment.createMany({
      data: schedule.installments.map((inst) => ({
        loanId: created.id,
        number: inst.number,
        dueDate: toUTCDate(inst.dueDate),
        principalDuePaise: inst.principalDuePaise,
        interestDuePaise: inst.interestDuePaise,
      })),
    });

    return created;
  });

  // Load the full installment list and return as the standard view
  return getLoan(loan.id, disbursementDate);
}

/**
 * Fetches a loan with its installments and computes current position.
 *
 * @param {string} id - Loan UUID
 * @param {string} asOf - ISO date string YYYY-MM-DD
 * @returns {Object} presentLoan output
 */
export async function getLoan(id, asOf) {
  if (!isUuid(id)) {
    throw new ApiError(404, 'LOAN_NOT_FOUND', `Loan ${id} not found`);
  }

  const loan = await db.loan.findUnique({ where: { id } });
  if (!loan) {
    throw new ApiError(404, 'LOAN_NOT_FOUND', `Loan ${id} not found`);
  }

  const installments = await db.installment.findMany({
    where: { loanId: id },
    orderBy: { number: 'asc' },
  });

  return presentLoan(loan, installments, asOf);
}
