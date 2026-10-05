const { generateSchedule } = require('../../src/lib/schedule.js');

describe('Loan Schedule Generation', () => {
  test('Reference case: ₹2,00,000 at 18% p.a. over 24 months yields ~₹9,986 EMI and exact 1st month interest', () => {
    const result = generateSchedule({
      principalPaise: 20000000,
      annualRatePercent: 18.0,
      tenureMonths: 24,
      disbursementDate: '2026-01-15',
    });

    // EMI within 200 paise of 998600 paise (₹9,986)
    expect(Math.abs(result.emiPaise - 998600)).toBeLessThanOrEqual(200);

    // 24 installments, numbered 1..24
    expect(result.installments.length).toBe(24);
    expect(result.installments[0].number).toBe(1);
    expect(result.installments[23].number).toBe(24);

    // First instalment interest is exactly 300000 paise (20000000 * 18% / 12 = 300000)
    expect(result.installments[0].interestDuePaise).toBe(300000);
  });

  test('Principal conservation: sum of principal parts equals initial principal with zero remaining balance and non-negative components', () => {
    const testCases = [
      { principalPaise: 5000000, annualRatePercent: 12.0, tenureMonths: 3, disbursementDate: '2026-01-01' },
      { principalPaise: 100000000, annualRatePercent: 24.0, tenureMonths: 36, disbursementDate: '2026-01-01' },
      { principalPaise: 12345789, annualRatePercent: 13.5, tenureMonths: 17, disbursementDate: '2026-05-10' },
      { principalPaise: 10000000, annualRatePercent: 0.0, tenureMonths: 12, disbursementDate: '2026-01-01' },
    ];

    testCases.forEach((params) => {
      const schedule = generateSchedule(params);
      const totalPrincipalPaid = schedule.installments.reduce((sum, inst) => sum + inst.principalDuePaise, 0);

      expect(totalPrincipalPaid).toBe(params.principalPaise);

      schedule.installments.forEach((inst) => {
        expect(inst.principalDuePaise).toBeGreaterThanOrEqual(0);
        expect(inst.interestDuePaise).toBeGreaterThanOrEqual(0);
        expect(inst.totalDuePaise).toBe(inst.principalDuePaise + inst.interestDuePaise);
      });
    });
  });

  test('Due dates generation with no day drift on month end disbursements', () => {
    const schedule = generateSchedule({
      principalPaise: 10000000,
      annualRatePercent: 12.0,
      tenureMonths: 3,
      disbursementDate: '2026-01-31',
    });

    expect(schedule.installments[0].dueDate).toBe('2026-02-28');
    expect(schedule.installments[1].dueDate).toBe('2026-03-31');
    expect(schedule.installments[2].dueDate).toBe('2026-04-30');
  });
});
