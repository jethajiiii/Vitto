const admin = require('firebase-admin');

/**
 * Initializes Firebase Admin SDK singleton.
 * Safe for Next.js hot-reloading by checking existing apps.
 */
function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not configured');
  }

  let serviceAccount;
  try {
    serviceAccount = typeof serviceAccountJson === 'string'
      ? JSON.parse(serviceAccountJson)
      : serviceAccountJson;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON format');
  }

  // Restore multiline RSA private key format from escaped newlines
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Returns the Firebase Admin Auth service instance.
 * Exported as a function to support testing and mocking.
 * @returns {admin.auth.Auth}
 */
function getAdminAuth() {
  initAdmin();
  return admin.auth();
}

module.exports = {
  getAdminAuth,
};
