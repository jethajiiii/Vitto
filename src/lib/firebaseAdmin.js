import jwt from 'jsonwebtoken';

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'vitto-5ae30';

// ─── Google Public Cert Cache ──────────────────────────────────────────────────
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
  // Cache for 1 hour or according to max-age header
  certsExpiry = now + 3600 * 1000;
  return cachedCerts;
}

/**
 * Verifies a Firebase ID token using Google's public x509 certificates.
 * Works statelessly across all Node.js environments (Vercel, AWS, local)
 * without requiring the heavy firebase-admin SDK.
 *
 * @param {string} token - Firebase ID token string
 * @returns {Promise<Object>} Decoded token payload
 */
export async function verifyIdToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }

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

export function getAdminAuth() {
  return {
    verifyIdToken,
  };
}

