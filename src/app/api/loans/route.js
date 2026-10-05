import { handle, ok } from '@/lib/errors.js';
import { requireAuth } from '@/lib/requireAuth.js';
import { readJson, validateCreateLoan } from '@/lib/validation.js';
import { createLoan } from '@/lib/services/loanService.js';

// POST /api/loans
// Creates a loan and its full installment schedule.
export const POST = handle(async (request) => {
  await requireAuth(request);
  const body = await readJson(request);
  const validated = validateCreateLoan(body);
  const loanView = await createLoan(validated);
  return ok(loanView, 201);
});
