const { ApiError } = require('./errors.js');
const { getAdminAuth } = require('./firebaseAdmin.js');

// Single generic message for all auth failures to avoid revealing which part failed
const AUTH_ERROR_MESSAGE = 'Authentication required';

/**
 * Extracts and verifies a Firebase ID token from the Authorization header.
 * Uses a single generic message for all failure modes to avoid information leakage.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<admin.auth.DecodedIdToken>} - Decoded Firebase token
 * @throws {ApiError} 401 UNAUTHENTICATED for any auth failure
 */
async function requireAuth(request) {
  const authHeader = request.headers.get('authorization');

  // Reject missing header, wrong scheme, or empty token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHENTICATED', AUTH_ERROR_MESSAGE);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', AUTH_ERROR_MESSAGE);
  }

  try {
    // Server-side token verification — checks signature, expiry, and project ID
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error('requireAuth token verification failed:', err.message || err);
    // Expired, malformed, or wrong-project tokens all map to the same 401
    throw new ApiError(401, 'UNAUTHENTICATED', AUTH_ERROR_MESSAGE);
  }
}

module.exports = {
  requireAuth,
};
