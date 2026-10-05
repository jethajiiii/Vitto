const db = require('../../src/lib/db.js');

async function resetDb() {
  if (process.env.TEST_DB !== '1') {
    throw new Error('resetDb REFUSES to run unless TEST_DB=1');
  }

  await db.$executeRawUnsafe(`
    TRUNCATE "PaymentAllocation", "Payment", "Installment", "Loan" CASCADE;
  `);
}

async function disconnectDb() {
  await db.$disconnect();
}

module.exports = {
  db,
  resetDb,
  disconnectDb,
};
