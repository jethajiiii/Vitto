const { ApiError } = require('./errors.js');
const { toPaise } = require('./money.js');
const { isValidISODate } = require('./dates.js');

/**
 * Safely reads and parses JSON from a Next.js Request object.
 * Returns 400 VALIDATION_ERROR on malformed JSON instead of 500.
 * @param {Request} request
 * @returns {Promise<any>}
 */
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
}

/**
 * Validates if a string is a valid UUID format.
 * @param {string} str
 * @returns {boolean}
 */
function isUuid(str) {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Validates loan creation payload and returns normalized domain types in paise.
 * Collects all field errors and throws a single ApiError (400) if any fail.
 * 
 * @param {Object} body
 * @returns {{ principalPaise: number, annualRatePercent: number, tenureMonths: number, disbursementDate: string }}
 */
function validateCreateLoan(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const details = [];
  let principalPaise;
  let annualRatePercent;
  let tenureMonths;
  let disbursementDate;

  // 1. Principal (₹50,000 to ₹10,00,000)
  if (body.principal === undefined || body.principal === null || body.principal === '') {
    details.push({ field: 'principal', message: 'Principal is required' });
  } else {
    try {
      principalPaise = toPaise(body.principal);
      if (principalPaise < 5000000 || principalPaise > 100000000) {
        details.push({
          field: 'principal',
          message: 'Principal must be between ₹50,000 and ₹10,00,000',
        });
      }
    } catch (err) {
      details.push({
        field: 'principal',
        message: err.message || 'Principal must be a valid number with at most 2 decimal places',
      });
    }
  }

  // 2. Annual Rate (0% to 100%, max 2 decimals)
  if (body.annualRate === undefined || body.annualRate === null || body.annualRate === '') {
    details.push({ field: 'annualRate', message: 'Annual interest rate is required' });
  } else {
    const rateStr = String(body.annualRate).trim();
    if (!/^\d+(\.\d+)?$/.test(rateStr)) {
      details.push({
        field: 'annualRate',
        message: 'Annual rate must be a valid positive number',
      });
    } else {
      const parts = rateStr.split('.');
      if (parts[1] && parts[1].length > 2) {
        details.push({
          field: 'annualRate',
          message: 'Annual rate cannot have more than 2 decimal places',
        });
      } else {
        const rate = Number(rateStr);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
          details.push({
            field: 'annualRate',
            message: 'Annual rate must be between 0% and 100%',
          });
        } else {
          annualRatePercent = rate;
        }
      }
    }
  }

  // 3. Tenure Months (integer 3 to 36)
  if (body.tenureMonths === undefined || body.tenureMonths === null || body.tenureMonths === '') {
    details.push({ field: 'tenureMonths', message: 'Tenure in months is required' });
  } else {
    const tenureStr = String(body.tenureMonths).trim();
    if (!/^\d+$/.test(tenureStr)) {
      details.push({
        field: 'tenureMonths',
        message: 'Tenure must be an integer',
      });
    } else {
      const tenure = Number(tenureStr);
      if (tenure < 3 || tenure > 36) {
        details.push({
          field: 'tenureMonths',
          message: 'Tenure must be between 3 and 36 months',
        });
      } else {
        tenureMonths = tenure;
      }
    }
  }

  // 4. Disbursement Date (strict YYYY-MM-DD)
  if (body.disbursementDate === undefined || body.disbursementDate === null || body.disbursementDate === '') {
    details.push({ field: 'disbursementDate', message: 'Disbursement date is required' });
  } else if (!isValidISODate(body.disbursementDate)) {
    details.push({
      field: 'disbursementDate',
      message: 'Disbursement date must be a valid YYYY-MM-DD date',
    });
  } else {
    disbursementDate = body.disbursementDate;
  }

  if (details.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  return {
    principalPaise,
    annualRatePercent,
    tenureMonths,
    disbursementDate,
  };
}

/**
 * Validates payment recording payload and Idempotency-Key header.
 * 
 * @param {Object} body
 * @param {Headers|Object} headers
 * @returns {{ amountPaise: number, paidOn: string, idempotencyKey: string }}
 */
function validatePayment(body, headers) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const details = [];
  let amountPaise;
  let paidOn;
  let idempotencyKey;

  // 1. Amount (> 0, max 2 decimals)
  if (body.amount === undefined || body.amount === null || body.amount === '') {
    details.push({ field: 'amount', message: 'Payment amount is required' });
  } else {
    try {
      amountPaise = toPaise(body.amount);
      if (amountPaise <= 0) {
        details.push({ field: 'amount', message: 'Payment amount must be greater than 0' });
      }
    } catch (err) {
      details.push({
        field: 'amount',
        message: err.message || 'Payment amount must be a valid number with at most 2 decimal places',
      });
    }
  }

  // 2. Date (strict YYYY-MM-DD)
  if (body.date === undefined || body.date === null || body.date === '') {
    details.push({ field: 'date', message: 'Payment date is required' });
  } else if (!isValidISODate(body.date)) {
    details.push({
      field: 'date',
      message: 'Payment date must be a valid YYYY-MM-DD date',
    });
  } else {
    paidOn = body.date;
  }

  // 3. Idempotency-Key header (8 to 128 chars, [A-Za-z0-9_-])
  const rawKey = headers && typeof headers.get === 'function'
    ? (headers.get('idempotency-key') || headers.get('Idempotency-Key'))
    : (headers && (headers['idempotency-key'] || headers['Idempotency-Key']));

  if (!rawKey || typeof rawKey !== 'string') {
    details.push({
      field: 'idempotencyKey',
      message: 'Idempotency-Key header is required',
    });
  } else {
    const trimmed = rawKey.trim();
    if (trimmed.length < 8 || trimmed.length > 128 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      details.push({
        field: 'idempotencyKey',
        message: 'Idempotency-Key must be 8-128 alphanumeric, hyphen or underscore characters',
      });
    } else {
      idempotencyKey = trimmed;
    }
  }

  if (details.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  return {
    amountPaise,
    paidOn,
    idempotencyKey,
  };
}

/**
 * Validates the optional asOf query parameter, defaulting to current date in Asia/Kolkata timezone.
 * @param {URLSearchParams|Object} searchParams
 * @returns {string} - YYYY-MM-DD ISO date string
 */
function validateAsOf(searchParams) {
  const asOfParam = searchParams && typeof searchParams.get === 'function'
    ? searchParams.get('asOf')
    : (searchParams && searchParams.asOf);

  if (asOfParam) {
    if (!isValidISODate(asOfParam)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid asOf date (must be YYYY-MM-DD)');
    }
    return asOfParam;
  }

  // Default to today in Asia/Kolkata timezone
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

module.exports = {
  readJson,
  isUuid,
  validateCreateLoan,
  validatePayment,
  validateAsOf,
};
