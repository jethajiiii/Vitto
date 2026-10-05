/**
 * Helper to build Next.js / standard Web API Request objects.
 */
function createRequest(url, { method = 'GET', body = null, headers = {} } = {}) {
  const reqHeaders = new Headers();

  Object.entries(headers).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      reqHeaders.set(key, val);
    }
  });

  const init = {
    method,
    headers: reqHeaders,
  };

  if (body !== null && body !== undefined) {
    if (typeof body === 'object') {
      init.body = JSON.stringify(body);
      if (!reqHeaders.has('content-type')) {
        reqHeaders.set('content-type', 'application/json');
      }
    } else {
      init.body = String(body);
    }
  }

  return new Request(url, init);
}

/**
 * Invokes a Next.js App Router route handler passing params as a Promise.
 */
async function callRoute(handler, request, params = {}) {
  return await handler(request, { params: Promise.resolve(params) });
}

module.exports = {
  createRequest,
  callRoute,
};
