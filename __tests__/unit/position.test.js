const { computePosition } = require('../../src/lib/position.js');

describe('Loan Position Computation', () => {
  test('accurately calculates overdue amounts, next due installment, and settled loan positions', () => {
    // 3-installment hand-built fixture
    const createFixture = () => [
      {
        number: 1,
        dueDate: '2026-07-15',
        principalDuePaise: 7000,
        interestDuePaise: 3000,
        principalPaidPaise: 0,
        interestPaidPaise: 0,
      },
      {
        number: 2,
        dueDate: '2026-08-15',
        principalDuePaise: 7000,
        interestDuePaise: 3000,
        principalPaidPaise: 0,
        interestPaidPaise: 0,
      },
      {
        number: 3,
        dueDate: '2026-09-15',
        principalDuePaise: 7000,
        interestDuePaise: 3000,
        principalPaidPaise: 0,
        interestPaidPaise: 0,
      },
    ];

    // Case 1: asOf equals due date (2026-07-15) -> Not overdue
    const pos1 = computePosition(createFixture(), '2026-07-15');
    expect(pos1.overdueAmountPaise).toBe(0);
    expect(pos1.overdueInstallmentCount).toBe(0);
    expect(pos1.nextDue).toEqual({
      number: 1,
      dueDate: '2026-07-15',
      amountPaise: 10000,
    });
    expect(pos1.outstandingPrincipalPaise).toBe(21000);
    expect(pos1.outstandingTotalPaise).toBe(30000);

    // Case 2: asOf is the day after due date (2026-07-16) -> Installment 1 is overdue, nextDue is Installment 2
    const pos2 = computePosition(createFixture(), '2026-07-16');
    expect(pos2.overdueAmountPaise).toBe(10000);
    expect(pos2.overdueInstallmentCount).toBe(1);
    expect(pos2.nextDue).toEqual({
      number: 2,
      dueDate: '2026-08-15',
      amountPaise: 10000, // nextDue skips overdue installment #1
    });

    // Case 3: Partially paid overdue installment (e.g. 4,000 paid on installment 1, remaining 6,000)
    const partialFixture = createFixture();
    partialFixture[0].interestPaidPaise = 3000;
    partialFixture[0].principalPaidPaise = 1000;

    const pos3 = computePosition(partialFixture, '2026-07-16');
    expect(pos3.overdueAmountPaise).toBe(6000); // Only remaining balance is overdue
    expect(pos3.overdueInstallmentCount).toBe(1);
    expect(pos3.outstandingPrincipalPaise).toBe(20000);
    expect(pos3.outstandingTotalPaise).toBe(26000);
    expect(pos3.nextDue.number).toBe(2);

    // Case 4: Fully paid loan returns nextDue null and all totals zero
    const paidFixture = createFixture().map((inst) => ({
      ...inst,
      principalPaidPaise: inst.principalDuePaise,
      interestPaidPaise: inst.interestDuePaise,
    }));

    const pos4 = computePosition(paidFixture, '2026-10-01');
    expect(pos4.nextDue).toBeNull();
    expect(pos4.outstandingPrincipalPaise).toBe(0);
    expect(pos4.outstandingTotalPaise).toBe(0);
    expect(pos4.overdueAmountPaise).toBe(0);
    expect(pos4.overdueInstallmentCount).toBe(0);
  });
});
