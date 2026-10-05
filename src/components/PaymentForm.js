'use client';

const { useState } = require('react');
const { signOut } = require('firebase/auth');
const { getClientAuth } = require('../lib/firebaseClient.js');
const { apiFetch, ApiClientError } = require('../lib/apiClient.js');
const { todayIST, formatINR } = require('../lib/format.js');

export default function PaymentForm({ loanId, disbursementDate, onPaymentSuccess }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayIST());
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null);
  const [is401, setIs401] = useState(false);

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setIdempotencyKey(crypto.randomUUID()); // New key whenever amount changes
    setFieldErrors((prev) => ({ ...prev, amount: null }));
    setServerError(null);
    setSuccessInfo(null);
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    setIdempotencyKey(crypto.randomUUID()); // New key whenever date changes
    setFieldErrors((prev) => ({ ...prev, date: null }));
    setServerError(null);
    setSuccessInfo(null);
  };

  const handleSignOut = async () => {
    try {
      const auth = getClientAuth();
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const validateClientSide = () => {
    const errors = {};

    if (!amount || amount.trim() === '') {
      errors.amount = 'Amount is required';
    } else {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        errors.amount = 'Amount must be a positive number';
      } else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
        errors.amount = 'Amount cannot have more than 2 decimal places';
      }
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.date = 'Valid payment date (YYYY-MM-DD) is required';
    } else if (disbursementDate && date < disbursementDate) {
      errors.date = `Payment date cannot be before disbursement date (${disbursementDate})`;
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});
    setSuccessInfo(null);
    setIs401(false);

    // Fast client-side check
    const localErrors = validateClientSide();
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setSubmitting(true);

    try {
      // Send payment payload to API
      const result = await apiFetch(`/api/loans/${encodeURIComponent(loanId)}/payments`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: {
          amount: parseFloat(amount),
          date: date,
        },
      });

      // Payment recorded successfully or exact replay returned
      const { payment } = result;

      if (payment.replayed) {
        setSuccessInfo({
          replayed: true,
          message: 'This payment was already recorded. Nothing was applied twice.',
        });
      } else {
        const allocationItems = (payment.applied || []).map(
          (a) => `Instalment ${a.installment}: interest ${formatINR(a.interest)}, principal ${formatINR(a.principal)}`
        );
        const allocationText = allocationItems.length > 0
          ? allocationItems.join(' | ')
          : 'Payment recorded.';

        setSuccessInfo({
          replayed: false,
          message: `Payment of ₹${formatINR(payment.amount)} recorded successfully. (${allocationText})`,
        });
      }

      // Update parent state in-place with the updated loan view from response
      onPaymentSuccess(result);

      // Reset amount and generate new idempotency key for next payment
      setAmount('');
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setIs401(true);
          setServerError('Your session has expired. Please sign in again.');
        } else if (err.status === 400 && Array.isArray(err.details)) {
          // Map server validation details to field errors
          const mapped = {};
          err.details.forEach((d) => {
            if (d.field) mapped[d.field] = d.message;
          });
          setFieldErrors(mapped);
          setServerError(err.message || 'Validation error.');
        } else {
          setServerError(err.message || 'Payment failed.');
        }
      } else {
        setServerError("Couldn't reach the server. Please check your connection.");
      }
      // Note: On error / 5xx / network failure, idempotencyKey is preserved so retry sends the SAME key!
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="payment-form-section">
      <h3 className="section-title">Record New Payment</h3>

      {successInfo && (
        <div className={`banner ${successInfo.replayed ? 'info-banner' : 'success-banner'}`}>
          {successInfo.message}
        </div>
      )}

      {serverError && (
        <div className="error-banner">
          {serverError}
          {is401 && (
            <button type="button" onClick={handleSignOut} className="btn-secondary btn-sm ml-2">
              Sign In Again
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="payment-form">
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="payment-amount">Payment Amount (₹)</label>
            <input
              id="payment-amount"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 5000.00"
              value={amount}
              onChange={handleAmountChange}
              disabled={submitting}
              className={fieldErrors.amount ? 'input-error' : ''}
            />
            {fieldErrors.amount && <span className="field-error-msg">{fieldErrors.amount}</span>}
          </div>

          <div className="form-group flex-1">
            <label htmlFor="payment-date">Payment Date</label>
            <input
              id="payment-date"
              type="date"
              value={date}
              onChange={handleDateChange}
              disabled={submitting}
              className={fieldErrors.date ? 'input-error' : ''}
            />
            {fieldErrors.date && <span className="field-error-msg">{fieldErrors.date}</span>}
          </div>

          <div className="form-group form-btn-group">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
