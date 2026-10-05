export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    if (details) {
      this.details = details;
    }
  }
}

/**
 * Formats an error into a standardized JSON response envelope.
 * @param {Error|ApiError} err
 * @returns {Response}
 */
export function errorResponse(err) {
  if (err instanceof ApiError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    return Response.json(body, { status: err.status });
  }

  // Generic 500 error envelope for unexpected server errors
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong.',
      },
    },
    { status: 500 }
  );
}

/**
 * Higher-order function that wraps a Next.js route handler.
 * Catches ApiError and unhandled exceptions, returning standard error envelopes.
 * @param {Function} fn - Async route handler (request, context) => Promise<Response>
 * @returns {Function}
 */
export function handle(fn) {
  return async function wrappedHandler(request, context) {
    try {
      return await fn(request, context);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err);
      }
      // Log unexpected error internally without leaking details to client
      console.error('Unhandled internal error:', err);
      return errorResponse(err);
    }
  };
}

/**
 * Creates a standardized success JSON response envelope.
 * @param {any} data
 * @param {number} status
 * @returns {Response}
 */
export function ok(data, status = 200) {
  return Response.json({ data }, { status });
}
