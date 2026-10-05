const { allocate } = require('../../src/lib/allocation.js');
const { generateSchedule } = require('../../src/lib/schedule.js');
const { ApiError } = require('../../src/lib/errors.js');

function createFreshInstallments() {
  const schedule = generateSchedule({
    principalPaise: 20000000,
    annualRatePercent: 18.0,
    tenureMonths: 24,
    disbursementDate: '2026-06-15',
  });

  return schedule.installments.map((inst) => ({
    number: inst.number,
    dueDate: inst.dueDate,
    principalDuePaise: inst.principalDuePaise,
    interestDuePaise: inst.interestDuePaise,
    principalPaidPaise: 0,
    interestPaidPaise: 0,
  }));
}

describe('Payment Allocation Logic', () => {
  test('Underpayment allocates to interest first, then principal on oldest unsettled installment', () => {
    const installments = createFreshInstallments();
    const result = allocate(500000, installments);

    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0]).toEqual({
      number: 1,
      interestPaise: 300000, // 300000 interest paid first
      principalPaise: 200000, // remaining 200000 towards principal
    });
    expect(result.totalAppliedPaise).toBe(500000);

    const sumAllocated = result.allocations.reduce(
      (sum, a) => sum + a.interestPaise + a.principalPaise,
      0
    );
    expect(sumAllocated).toBe(500000);
  });

  test('Overpayment settles consecutive installments in order and 1 paisa applies to next interest', () => {
    const installments = createFreshInstallments();
    const emi = 998482; // 9984.82 rupees

    // Pay 2 x EMI
    const payment1 = allocate(2 * emi, installments);
    expect(payment1.allocations.length).toBe(2);

    expect(payment1.allocations[0]).toEqual({
      number: 1,
      interestPaise: 300000,
      principalPaise: 698482,
    });
    expect(payment1.allocations[1]).toEqual({
      number: 2,
      interestPaise: 289523,
      principalPaise: 708959,
    });

    // Simulate state update after paying first 2 installments
    installments[0].interestPaidPaise = 300000;
    installments[0].principalPaidPaise = 698482;
    installments[1].interestPaidPaise = 289523;
    installments[1].principalPaidPaise = 708959;

    // A third payment of 1 paisa
    const payment2 = allocate(1, installments);
    expect(payment2.allocations).toEqual([
      {
        number: 3,
        interestPaise: 1,
        principalPaise: 0,
      },
    ]);
    expect(payment2.totalAppliedPaise).toBe(1);
  });

  test('Edge cases: partially paid installment continues to principal, exact total settles all, overpayment throws 422', () => {
    const installments = createFreshInstallments();

    // (a) Partially paid installment (interest fully paid, 0 principal paid)
    installments[0].interestPaidPaise = 300000;
    installments[0].principalPaidPaise = 0;

    const resultPart = allocate(100000, installments);
    expect(resultPart.allocations).toEqual([
      {
        number: 1,
        interestPaise: 0,
        principalPaise: 100000,
      },
    ]);

    // Reset fresh installments for total owed calculation
    const fresh = createFreshInstallments();
    const totalOwed = fresh.reduce(
      (sum, inst) => sum + inst.principalDuePaise + inst.interestDuePaise,
      0
    );

    // (b) Exact total owed settles all 24 installments
    const resultAll = allocate(totalOwed, fresh);
    expect(resultAll.allocations.length).toBe(24);
    expect(resultAll.totalAppliedPaise).toBe(totalOwed);

    // (c) Total owed plus 1 paisa throws 422 AMOUNT_EXCEEDS_OUTSTANDING without mutating input
    const snapshotBefore = JSON.stringify(fresh);
    expect(() => allocate(totalOwed + 1, fresh)).toThrow(ApiError);
    try {
      allocate(totalOwed + 1, fresh);
    } catch (err) {
      expect(err.status).toBe(422);
      expect(err.code).toBe('AMOUNT_EXCEEDS_OUTSTANDING');
    }
    expect(JSON.stringify(fresh)).toBe(snapshotBefore);
  });
});
