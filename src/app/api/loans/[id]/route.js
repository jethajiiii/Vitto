import { handle, ok, ApiError } from '@/lib/errors.js';
import { requireAuth } from '@/lib/requireAuth.js';
import { validateAsOf, isUuid } from '@/lib/validation.js';
import { getLoan } from '@/lib/services/loanService.js';

// GET /api/loans/[id]
// Returns the loan schedule and current position.
export const GET = handle(async (request, { params }) => {
  await requireAuth(request);
  const { id } = await params; // Next.js 16 params is a Promise

  if (!isUuid(id)) {
    throw new ApiError(404, 'LOAN_NOT_FOUND', `Loan ${id} not found`);
  }

  const { searchParams } = new URL(request.url);
  const asOf = validateAsOf(searchParams);

  const loanView = await getLoan(id, asOf);
  return ok(loanView);
});
