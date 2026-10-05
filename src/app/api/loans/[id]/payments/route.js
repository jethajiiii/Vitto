const { handle, ok, ApiError } = require('@/lib/errors.js');
const { requireAuth } = require('@/lib/requireAuth.js');
const { readJson, validatePayment, validateAsOf, isUuid } = require('@/lib/validation.js');
const { recordPayment } = require('@/lib/services/paymentService.js');

// POST /api/loans/[id]/payments
// Records a payment against the loan's installment schedule.
export const POST = handle(async (request, { params }) => {
  await requireAuth(request);

  const { id } = await params; // Next.js 16: params is a Promise

  if (!isUuid(id)) {
    throw new ApiError(404, 'LOAN_NOT_FOUND', `Loan ${id} not found`);
  }

  const body = await readJson(request);
  const validated = validatePayment(body, request.headers);

  const { searchParams } = new URL(request.url);
  const asOf = validateAsOf(searchParams);

  const result = await recordPayment(id, validated, asOf);

  // 200 for a replay, 201 for a new payment
  const status = result.payment.replayed ? 200 : 201;
  return ok(result, status);
});
