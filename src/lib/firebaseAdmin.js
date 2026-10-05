/**
 * Firebase Admin SDK helper — modular API edition.
 *
 * This version of firebase-admin exports: initializeApp, getApps, getApp,
 * cert, etc. directly. The legacy `admin.apps` / `admin.auth()` namespace
 * does NOT exist. Always use getApps() and getAuth() from 'firebase-admin/auth'.
 */

const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const jwt = require('jsonwebtoken');

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'vitto-5ae30';

// ─── Public-cert cache (used when no service-account key is present) ─────────
let cachedCerts = null;
let certsExpiry = 0;

async function getGooglePublicCerts() {
  const now = Date.now();
  if (cachedCerts && now < certsExpiry) return cachedCerts;

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) throw new Error('Failed to fetch Google public certificates');

  cachedCerts = await res.json();
  certsExpiry = now + 3600 * 1000; // cache for 1 hour
  return cachedCerts;
}

async function verifyTokenWithPublicKeys(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) {
    throw new Error('Invalid Firebase ID token: missing key ID');
  }

  const certs = await getGooglePublicCerts();
  const publicCert = certs[decoded.header.kid];
  if (!publicCert) {
    throw new Error('Firebase ID token signed by unknown key ID');
  }

  return jwt.verify(token, publicCert, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
}

// ─── App singleton ────────────────────────────────────────────────────────────
function getAdminApp() {
  // getApps() returns [] when no app has been initialised yet
  const existing = getApps();
  if (existing.length > 0) return getApp();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccount = null;

  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      // malformed JSON — fall back to public-cert verification
    }
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (serviceAccount?.private_key || serviceAccount?.privateKey) {
    const key = serviceAccount.private_key || serviceAccount.privateKey;
    serviceAccount.private_key = key.replace(/\\n/g, '\n');
    return initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }

  // No private key available — initialise with projectId only.
  // verifyIdToken will use public-cert fallback below.
  return initializeApp({ projectId: PROJECT_ID });
}

// ─── Public export ────────────────────────────────────────────────────────────
/**
 * Returns an object with a verifyIdToken(token) method.
 * If a service-account credential is configured it delegates to firebase-admin's
 * built-in verifier; otherwise it verifies the token using Google's public certs
 * and jsonwebtoken (no service account required).
 */
function getAdminAuth() {
  const hasCredential =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL);

  if (hasCredential) {
    const app = getAdminApp();
    return getAuth(app);
  }

  // No service-account private key — use public-cert JWT verification.
  return {
    verifyIdToken: verifyTokenWithPublicKeys,
  };
}

module.exports = { getAdminAuth };

