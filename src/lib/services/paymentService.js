import db from '../db.js';
import { allocate } from '../allocation.js';
import { toISODate } from '../presenters.js';
import { getLoan } from './loanService.js';
import { ApiError } from '../errors.js';

/**
 * Records a payment against a loan inside a serialised transaction.
 *
 * Steps (in order, all inside one transaction):
 *  1. Row-lock the loan (SELECT ... FOR UPDATE) — serialises concurrent payments.
 *  2. Check for an existing payment by idempotency key.
 *  3. Validate paidOn is not before disbursementDate.
 *  4. Load installments and call allocate() (pure, throws 422 if overpayment).
 *  5. Insert Payment, PaymentAllocation rows, increment installment paid amounts.
 *
 * @param {string} loanId
 * @param {{ amountPaise: number, paidOn: string, idempotencyKey: string }} params
 * @param {string} asOf - ISO date for the response view
 * @returns {{ payment, ...loanView, replayed: boolean }}
 */
export async function recordPayment(loanId, { amountPaise, paidOn, idempotencyKey }, asOf) {
  let payment;
  let allocations;
  let replayed = false;

  try {
    await db.$transaction(
      async (tx) => {
        // 1. Lock the loan row to serialise concurrent payments on the same loan
        const rows = await tx.$queryRaw`
          SELECT id, "disbursementDate" FROM "Loan" WHERE id = ${loanId} FOR UPDATE
        `;
        if (!rows || rows.length === 0) {
          throw new ApiError(404, 'LOAN_NOT_FOUND', `Loan ${loanId} not found`);
        }
        const loanRow = rows[0];

        // 2. Idempotency check: look for an existing payment with the same key
        const existing = await tx.payment.findUnique({
          where: { loanId_idempotencyKey: { loanId, idempotencyKey } },
        });

        if (existing) {
          if (existing.amountPaise === amountPaise && toISODate(existing.paidOn) === paidOn) {
            // Exact replay — return without writing anything
            payment = existing;
            replayed = true;
            return;
          }
          // Same key but different amount or date — conflict
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'A payment with this Idempotency-Key already exists with different amount or date'
          );
        }

        // 3. Validate paidOn is not before disbursement date
        const disbDate = toISODate(loanRow.disbursementDate);
        if (paidOn < disbDate) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Payment date cannot be before the loan disbursement date', [
            { field: 'date', message: `Date must be on or after ${disbDate}` },
          ]);
        }

        // 4. Load installments and allocate payment (throws 422 if amount exceeds outstanding)
        const installments = await tx.installment.findMany({
          where: { loanId },
          orderBy: { number: 'asc' },
        });

        const installmentShape = installments.map((inst) => ({
          number: inst.number,
          dueDate: toISODate(inst.dueDate),
          principalDuePaise: inst.principalDuePaise,
          interestDuePaise: inst.interestDuePaise,
          principalPaidPaise: inst.principalPaidPaise,
          interestPaidPaise: inst.interestPaidPaise,
        }));

        // Pure allocation — throws AMOUNT_EXCEEDS_OUTSTANDING (422) before writing anything
        const result = allocate(amountPaise, installmentShape);
        allocations = result.allocations;

        // Build a number -> id lookup for installments
        const instById = Object.fromEntries(installments.map((i) => [i.number, i.id]));

        // 5a. Insert the Payment record
        payment = await tx.payment.create({
          data: {
            loanId,
            amountPaise,
            paidOn: new Date(`${paidOn}T00:00:00.000Z`),
            idempotencyKey,
          },
        });

        // 5b. Insert PaymentAllocation rows
        await tx.paymentAllocation.createMany({
          data: allocations.map((a) => ({
            paymentId: payment.id,
            installmentId: instById[a.number],
            interestPaise: a.interestPaise,
            principalPaise: a.principalPaise,
          })),
        });

        // 5c. Increment paid amounts on each touched installment atomically
        await Promise.all(
          allocations.map((a) =>
            tx.installment.update({
              where: { id: instById[a.number] },
              data: {
                interestPaidPaise: { increment: a.interestPaise },
                principalPaidPaise: { increment: a.principalPaise },
              },
            })
          )
        );
      },
      { timeout: 10000 } // 10-second timeout to avoid long-held locks
    );
  } catch (err) {
    // Backstop: if another request won the race and caused a unique violation,
    // treat it as a replay of an identical payment
    if (err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey')) {
      const existing = await db.payment.findUnique({
        where: { loanId_idempotencyKey: { loanId, idempotencyKey } },
      });
      if (existing) {
        payment = existing;
        replayed = true;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // Build the response AFTER the transaction closes so we read committed data
  const loanView = await getLoan(loanId, asOf);

  let applied;
  if (replayed) {
    const storedAllocations = await db.paymentAllocation.findMany({
      where: { paymentId: payment.id },
      include: { installment: { select: { number: true } } },
      orderBy: { installment: { number: 'asc' } },
    });
    applied = storedAllocations.map((pa) => ({
      installment: pa.installment.number,
      interest: (pa.interestPaise / 100).toFixed(2),
      principal: (pa.principalPaise / 100).toFixed(2),
    }));
  } else {
    applied = allocations.map((a) => ({
      installment: a.number,
      interest: (a.interestPaise / 100).toFixed(2),
      principal: (a.principalPaise / 100).toFixed(2),
    }));
  }

  const paymentData = {
    id: payment.id,
    amount: (payment.amountPaise / 100).toFixed(2),
    date: toISODate(payment.paidOn),
    applied,
    replayed,
  };

  return { payment: paymentData, ...loanView };
}
