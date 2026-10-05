jest.mock('@/lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({
    verifyIdToken: async (token) => {
      if (token === 'valid-token') {
        return { uid: 'test-user-123' };
      }
      throw new Error('Invalid authentication token');
    },
  }),
}));

const { resetDb, disconnectDb, db } = require('../helpers/db.js');
const { createRequest, callRoute } = require('../helpers/request.js');

const { POST: postLoan } = require('../../src/app/api/loans/route.js');
const { GET: getLoan } = require('../../src/app/api/loans/[id]/route.js');
const { POST: postPayment } = require('../../src/app/api/loans/[id]/payments/route.js');

describe('API Integration Tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  test('Success path: create loan, record payment, replay payment idempotently, get position', async () => {
    // 1. POST /api/loans (200000 rupees, 18%, 24 months, disbursed 2026-06-15)
    const createReq = createRequest('http://localhost:3000/api/loans', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: {
        principal: 200000,
        annualRate: 18,
        tenureMonths: 24,
        disbursementDate: '2026-06-15',
      },
    });

    const createRes = await callRoute(postLoan, createReq);
    expect(createRes.status).toBe(201);
    const { data: createData } = await createRes.json();
    const loanId = createData.loan.id;
    expect(loanId).toBeDefined();
    expect(createData.schedule).toHaveLength(24);

    // 2. POST a payment of 5000 with an Idempotency-Key
    const paymentReq = createRequest(`http://localhost:3000/api/loans/${loanId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Idempotency-Key': 'key-test-12345',
      },
      body: {
        amount: 5000,
        date: '2026-07-15',
      },
    });

    const paymentRes = await callRoute(postPayment, paymentReq, { id: loanId });
    expect(paymentRes.status).toBe(201);
    const { data: paymentData } = await paymentRes.json();
    expect(paymentData.payment.replayed).toBe(false);
    expect(paymentData.payment.applied).toEqual([
      {
        installment: 1,
        interest: '3000.00',
        principal: '2000.00',
      },
    ]);

    // 3. Replaying the SAME key and body returns 200 with replayed: true and same allocation
    const replayReq = createRequest(`http://localhost:3000/api/loans/${loanId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Idempotency-Key': 'key-test-12345',
      },
      body: {
        amount: 5000,
        date: '2026-07-15',
      },
    });

    const replayRes = await callRoute(postPayment, replayReq, { id: loanId });
    expect(replayRes.status).toBe(200);
    const { data: replayData } = await replayRes.json();
    expect(replayData.payment.replayed).toBe(true);
    expect(replayData.payment.applied).toEqual([
      {
        installment: 1,
        interest: '3000.00',
        principal: '2000.00',
      },
    ]);

    // Assert in DB via Prisma: exactly 1 Payment row, installment 1 paid amounts did not change
    const paymentRows = await db.payment.findMany({ where: { loanId } });
    expect(paymentRows).toHaveLength(1);

    const inst1 = await db.installment.findUnique({
      where: { loanId_number: { loanId, number: 1 } },
    });
    expect(inst1.interestPaidPaise).toBe(300000);
    expect(inst1.principalPaidPaise).toBe(200000);

    // 4. GET the loan and assert position for asOf=2026-10-05
    const getReq = createRequest(`http://localhost:3000/api/loans/${loanId}?asOf=2026-10-05`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const getRes = await callRoute(getLoan, getReq, { id: loanId });
    expect(getRes.status).toBe(200);
    const { data: getData } = await getRes.json();

    expect(getData.loan.id).toBe(loanId);
    expect(getData.position.asOf).toBe('2026-10-05');
    expect(getData.position.outstandingPrincipal).toBe('198000.00');
    expect(getData.position.nextDue).toBeDefined();
    expect(getData.position.overdueAmount).toBeDefined();
  });

  test('Failure path: handles overpayment, validation errors, and missing loan with DB rollback safety', async () => {
    // Create a loan first
    const createReq = createRequest('http://localhost:3000/api/loans', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: {
        principal: 50000,
        annualRate: 12,
        tenureMonths: 12,
        disbursementDate: '2026-06-15',
      },
    });
    const createRes = await callRoute(postLoan, createReq);
    expect(createRes.status).toBe(201);
    const { data: { loan } } = await createRes.json();
    const loanId = loan.id;

    // 1. Payment larger than total owed returns 422 AMOUNT_EXCEEDS_OUTSTANDING
    const overpayReq = createRequest(`http://localhost:3000/api/loans/${loanId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Idempotency-Key': 'fail-key-overpay',
      },
      body: {
        amount: 1000000,
        date: '2026-07-15',
      },
    });
    const overpayRes = await callRoute(postPayment, overpayReq, { id: loanId });
    expect(overpayRes.status).toBe(422);
    const overpayErr = await overpayRes.json();
    expect(overpayErr.error.code).toBe('AMOUNT_EXCEEDS_OUTSTANDING');

    // 2. Amount of -500 returns 400 VALIDATION_ERROR
    const invalidAmountReq = createRequest(`http://localhost:3000/api/loans/${loanId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Idempotency-Key': 'fail-key-invalid',
      },
      body: {
        amount: -500,
        date: '2026-07-15',
      },
    });
    const invalidAmountRes = await callRoute(postPayment, invalidAmountReq, { id: loanId });
    expect(invalidAmountRes.status).toBe(400);
    const invalidAmountErr = await invalidAmountRes.json();
    expect(invalidAmountErr.error.code).toBe('VALIDATION_ERROR');

    // 3. Unknown UUID returns 404
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    const notFoundReq = createRequest(`http://localhost:3000/api/loans/${nonExistentUuid}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Idempotency-Key': 'fail-key-404',
      },
      body: {
        amount: 1000,
        date: '2026-07-15',
      },
    });
    const notFoundRes = await callRoute(postPayment, notFoundReq, { id: nonExistentUuid });
    expect(notFoundRes.status).toBe(404);

    // Afterwards assert DB has ZERO Payment and PaymentAllocation rows, and every installment is unpaid
    const paymentCount = await db.payment.count({ where: { loanId } });
    expect(paymentCount).toBe(0);

    const allocationCount = await db.paymentAllocation.count();
    expect(allocationCount).toBe(0);

    const installments = await db.installment.findMany({ where: { loanId } });
    installments.forEach((inst) => {
      expect(inst.principalPaidPaise).toBe(0);
      expect(inst.interestPaidPaise).toBe(0);
    });
  });

  test('Unauthenticated requests: missing or invalid authorization header returns 401 and creates no DB rows', async () => {
    // 1. Missing Authorization header on all 3 routes returns 401 UNAUTHENTICATED
    const postLoanNoAuth = createRequest('http://localhost:3000/api/loans', {
      method: 'POST',
      body: {
        principal: 100000,
        annualRate: 12,
        tenureMonths: 6,
        disbursementDate: '2026-06-15',
      },
    });
    const res1 = await callRoute(postLoan, postLoanNoAuth);
    expect(res1.status).toBe(401);
    const err1 = await res1.json();
    expect(err1.error.code).toBe('UNAUTHENTICATED');

    const fakeId = '11111111-1111-1111-1111-111111111111';
    const getLoanNoAuth = createRequest(`http://localhost:3000/api/loans/${fakeId}`);
    const res2 = await callRoute(getLoan, getLoanNoAuth, { id: fakeId });
    expect(res2.status).toBe(401);

    const postPayNoAuth = createRequest(`http://localhost:3000/api/loans/${fakeId}/payments`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'no-auth-key-1' },
      body: { amount: 1000, date: '2026-07-15' },
    });
    const res3 = await callRoute(postPayment, postPayNoAuth, { id: fakeId });
    expect(res3.status).toBe(401);

    // 2. Authorization header "Bearer garbage" returns 401 UNAUTHENTICATED on all 3 routes
    const postLoanGarbage = createRequest('http://localhost:3000/api/loans', {
      method: 'POST',
      headers: { Authorization: 'Bearer garbage' },
      body: {
        principal: 100000,
        annualRate: 12,
        tenureMonths: 6,
        disbursementDate: '2026-06-15',
      },
    });
    const res4 = await callRoute(postLoan, postLoanGarbage);
    expect(res4.status).toBe(401);

    const getLoanGarbage = createRequest(`http://localhost:3000/api/loans/${fakeId}`, {
      headers: { Authorization: 'Bearer garbage' },
    });
    const res5 = await callRoute(getLoan, getLoanGarbage, { id: fakeId });
    expect(res5.status).toBe(401);

    const postPayGarbage = createRequest(`http://localhost:3000/api/loans/${fakeId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer garbage',
        'Idempotency-Key': 'garbage-key-1',
      },
      body: { amount: 1000, date: '2026-07-15' },
    });
    const res6 = await callRoute(postPayment, postPayGarbage, { id: fakeId });
    expect(res6.status).toBe(401);

    // Assert no Loan row was created by unauthenticated POST
    const loanCount = await db.loan.count();
    expect(loanCount).toBe(0);
  });
});
