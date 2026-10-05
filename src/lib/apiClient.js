const { getClientAuth } = require('./firebaseClient.js');

/**
 * Custom error class representing an API error response.
 */
class ApiClientError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Performs an authenticated fetch to backend API endpoints.
 *
 * @param {string} path - API endpoint path (e.g., '/api/loans/123')
 * @param {object} [options={}] - Fetch options (method, body, headers)
 * @returns {Promise<any>} - Unwrapped data property from API response
 */
async function apiFetch(path, options = {}) {
  const auth = getClientAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new ApiClientError(401, 'UNAUTHENTICATED', 'Your session expired. Please sign in again.');
  }

  let token;
  try {
    // Request fresh ID token before every call
    token = await currentUser.getIdToken();
  } catch (err) {
    throw new ApiClientError(401, 'UNAUTHENTICATED', 'Your session expired. Please sign in again.');
  }

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
  };

  if (options.body && typeof options.body === 'object') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders = { ...defaultHeaders, ...options.headers };

  const fetchOptions = {
    ...options,
    headers: mergedHeaders,
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
  };

  let res;
  try {
    res = await fetch(path, fetchOptions);
  } catch (err) {
    throw new ApiClientError(0, 'NETWORK_ERROR', "Couldn't reach the server. Please check your connection.");
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ApiClientError(
      res.status || 500,
      'RESPONSE_PARSE_ERROR',
      "Couldn't reach the server. Unexpected server response format."
    );
  }

  if (!res.ok || json.error) {
    const errObj = json.error || {};
    throw new ApiClientError(
      res.status,
      errObj.code || 'UNKNOWN_ERROR',
      errObj.message || 'An unexpected error occurred.',
      errObj.details || null
    );
  }

  return json.data;
}

module.exports = { apiFetch, ApiClientError };
