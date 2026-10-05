'use client';

import { useState, useEffect } from 'react';
import AuthGate from '../components/AuthGate.js';
import PositionSummary from '../components/PositionSummary.js';
import ScheduleTable from '../components/ScheduleTable.js';
import PaymentForm from '../components/PaymentForm.js';
import { apiFetch, ApiClientError } from '../lib/apiClient.js';

const STORAGE_KEY = 'vitto_last_loan_id';

function LoanDashboard() {
  const [loanIdInput, setLoanIdInput] = useState('');
  const [activeLoanId, setActiveLoanId] = useState('');
  const [loanData, setLoanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touchedInstallments, setTouchedInstallments] = useState([]);

  // Load last searched loan ID from localStorage safely on mount
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        setLoanIdInput(savedId);
        fetchLoan(savedId);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const fetchLoan = async (idToFetch) => {
    const id = (idToFetch || loanIdInput).trim();
    if (!id) {
      setError('Please enter a valid Loan ID.');
      return;
    }

    setLoading(true);
    setError('');
    setTouchedInstallments([]);

    try {
      const data = await apiFetch(`/api/loans/${encodeURIComponent(id)}`);
      setLoanData(data);
      setActiveLoanId(id);

      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Ignore localStorage write failures
      }
    } catch (err) {
      setLoanData(null);
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load loan details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLoan();
  };

  // Called after a payment is successfully recorded to update state in-place without page reload
  const handlePaymentSuccess = (paymentResult) => {
    // paymentResult is { payment, loan, schedule, position }
    setLoanData({
      loan: paymentResult.loan,
      schedule: paymentResult.schedule,
      position: paymentResult.position,
    });

    if (paymentResult.payment?.applied) {
      const numbers = paymentResult.payment.applied.map((a) => a.installment);
      setTouchedInstallments(numbers);
    }
  };

  return (
    <div className="dashboard-container">
      <section className="search-section">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-group">
            <label htmlFor="loan-id-search" className="sr-only">Loan ID</label>
            <input
              id="loan-id-search"
              type="text"
              value={loanIdInput}
              onChange={(e) => setLoanIdInput(e.target.value)}
              placeholder="Enter Loan UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)"
              className="search-input"
              disabled={loading}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Loading...' : 'Load Loan'}
            </button>
          </div>
        </form>
        {error && <div className="error-banner search-error">{error}</div>}
      </section>

      {loanData && (
        <>
          <PositionSummary loan={loanData.loan} position={loanData.position} />

          <PaymentForm
            loanId={activeLoanId}
            disbursementDate={loanData.loan.disbursementDate}
            onPaymentSuccess={handlePaymentSuccess}
          />

          <ScheduleTable
            schedule={loanData.schedule}
            touchedNumbers={touchedInstallments}
          />
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <LoanDashboard />
    </AuthGate>
  );
}
