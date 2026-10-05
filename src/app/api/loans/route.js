const { handle, ok } = require('@/lib/errors.js');
const { requireAuth } = require('@/lib/requireAuth.js');
const { readJson, validateCreateLoan } = require('@/lib/validation.js');
const { createLoan } = require('@/lib/services/loanService.js');

// POST /api/loans
// Creates a loan and its full installment schedule.
const POST = handle(async (request) => {
  await requireAuth(request);
  const body = await readJson(request);
  const validated = validateCreateLoan(body);
  const loanView = await createLoan(validated);
  return ok(loanView, 201);
});

module.exports = { POST };
