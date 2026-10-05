const path = require('path');
const dotenv = require('dotenv');

// Load environment from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = require('../src/lib/db.js');
const { createLoan } = require('../src/lib/services/loanService.js');
const { recordPayment } = require('../src/lib/services/paymentService.js');

function getTodayKolkata() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function addMonthsISO(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Safety guard: refuse if running against test DB
  if (process.env.TEST_DB === '1') {
    console.error('ERROR: Seed script refused to run because TEST_DB=1 is set.');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const existingCount = await db.loan.count();

  if (existingCount > 0) {
    if (!force) {
      console.log(`Database already contains ${existingCount} Loan record(s). Run with --force to overwrite.`);
      process.exit(0);
    }

    const payAllocCount = await db.paymentAllocation.count();
    const payCount = await db.payment.count();
    const instCount = await db.installment.count();

    console.log(
      `[--force] Clearing existing data: deleting ${payAllocCount} PaymentAllocation(s), ${payCount} Payment(s), ${instCount} Installment(s), ${existingCount} Loan(s)...`
    );

    await db.$executeRawUnsafe(`
      TRUNCATE "PaymentAllocation", "Payment", "Installment", "Loan" CASCADE;
    `);
  }

  const today = getTodayKolkata();
  console.log(`\nSeeding loans relative to today (${today} IST)...\n`);

  // ─── Loan A: "Fresh" ────────────────────────────────────────────────────────
  // 100,000 rupees, 12%, 6 months, disbursed 10 days ago. No payments.
  const disbA = addDaysISO(today, -10);
  const loanA = await createLoan({
    principalPaise: 10000000,
    annualRatePercent: 12,
    tenureMonths: 6,
    disbursementDate: disbA,
  });

  // ─── Loan B: "Overdue" ──────────────────────────────────────────────────────
  // 300,000 rupees, 15%, 12 months, disbursed 4 months ago.
  // Inst 1 paid in full on due date. Inst 2 paid 4000 rupees on due date. Nothing after.
  const disbB = addMonthsISO(today, -4);
  const loanB = await createLoan({
    principalPaise: 30000000,
    annualRatePercent: 15,
    tenureMonths: 12,
    disbursementDate: disbB,
  });

  const dueB1 = addMonthsISO(disbB, 1);
  const dueB2 = addMonthsISO(disbB, 2);

  // EMI for Loan B is 27,077.49 rupees (2707749 paise)
  const inst1B = loanB.schedule.find((i) => i.number === 1);
  const inst1TotalPaise = Math.round(Number(inst1B.totalDue) * 100);

  // Inst 1 paid in full
  await recordPayment(
    loanB.loan.id,
    {
      amountPaise: inst1TotalPaise,
      paidOn: dueB1,
      idempotencyKey: 'seed-B-1',
    },
    today
  );

  // Inst 2 paid only 4000 rupees (400000 paise)
  await recordPayment(
    loanB.loan.id,
    {
      amountPaise: 400000,
      paidOn: dueB2,
      idempotencyKey: 'seed-B-2',
    },
    today
  );

  // ─── Loan C: "Advance" ──────────────────────────────────────────────────────
  // 150,000 rupees, 12%, 6 months, disbursed 1 month ago.
  // Payment of 2.5 x EMI settles Inst 1 and 2, partially pays 3.
  const disbC = addMonthsISO(today, -1);
  const loanC = await createLoan({
    principalPaise: 15000000,
    annualRatePercent: 12,
    tenureMonths: 6,
    disbursementDate: disbC,
  });

  const dueC1 = addMonthsISO(disbC, 1);
  const emiCPaise = Math.round(Number(loanC.loan.emi) * 100);
  const advancePaymentPaise = Math.round(2.5 * emiCPaise);

  await recordPayment(
    loanC.loan.id,
    {
      amountPaise: advancePaymentPaise,
      paidOn: dueC1,
      idempotencyKey: 'seed-C-1',
    },
    today
  );

  // ─── Summary Table Output ────────────────────────────────────────────────────
  console.log('Seeding complete! Summary Table:\n');
  console.log(
    '+---------+--------------------------------------+----------------------+---------------------------------------------------------------+'
  );
  console.log(
    '| Label   | Loan ID                              | Terms                | What to Look For                                              |'
  );
  console.log(
    '+---------+--------------------------------------+----------------------+---------------------------------------------------------------+'
  );
  console.log(
    `| Fresh   | ${loanA.loan.id} | ₹1,00,000 / 12% / 6m | Clean schedule, no payments, nothing overdue                  |`
  );
  console.log(
    `| Overdue | ${loanB.loan.id} | ₹3,00,000 / 15% / 12m| Inst 1 paid, Inst 2 partial & overdue, Inst 3 unpaid & overdue|`
  );
  console.log(
    `| Advance | ${loanC.loan.id} | ₹1,50,000 / 12% / 6m | Paid 2.5x EMI: Inst 1 & 2 fully paid, Inst 3 partial          |`
  );
  console.log(
    '+---------+--------------------------------------+----------------------+---------------------------------------------------------------+\n'
  );
}

main()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
