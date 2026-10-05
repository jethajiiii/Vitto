'use client';

import { formatINR, formatDate } from '../lib/format.js';

export default function PositionSummary({ loan, position }) {
  if (!loan || !position) return null;

  const overdueVal = parseFloat(position.overdueAmount || '0');
  const isOverdue = overdueVal > 0;

  return (
    <section className="position-section">
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Outstanding Principal</span>
          <span className="metric-value">₹{formatINR(position.outstandingPrincipal)}</span>
          <span className="metric-subtext">Total due: ₹{formatINR(position.outstandingTotal)}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Next Due</span>
          {position.nextDue ? (
            <>
              <span className="metric-value">₹{formatINR(position.nextDue.amount)}</span>
              <span className="metric-subtext">Due on {formatDate(position.nextDue.dueDate)} (Instalment #{position.nextDue.number})</span>
            </>
          ) : (
            <>
              <span className="metric-value">None</span>
              <span className="metric-subtext">Loan is fully paid</span>
            </>
          )}
        </div>

        <div className={`metric-card ${isOverdue ? 'warning-card' : ''}`}>
          <span className="metric-label">Overdue Amount</span>
          <span className={`metric-value ${isOverdue ? 'text-warning' : ''}`}>
            ₹{formatINR(position.overdueAmount)}
          </span>
          <span className="metric-subtext">
            {isOverdue ? (
              <span className="warning-badge">
                ⚠️ {position.overdueInstallmentCount} instalment{position.overdueInstallmentCount === 1 ? '' : 's'} overdue
              </span>
            ) : (
              'No overdue payments'
            )}
          </span>
        </div>
      </div>

      <div className="terms-card">
        <h3 className="terms-title">Loan Terms</h3>
        <div className="terms-grid">
          <div className="term-item">
            <span className="term-label">Disbursed Principal</span>
            <span className="term-value">₹{formatINR(loan.principal)}</span>
          </div>
          <div className="term-item">
            <span className="term-label">Interest Rate</span>
            <span className="term-value">{loan.annualRatePercent}% p.a.</span>
          </div>
          <div className="term-item">
            <span className="term-label">Tenure</span>
            <span className="term-value">{loan.tenureMonths} Months</span>
          </div>
          <div className="term-item">
            <span className="term-label">Monthly EMI</span>
            <span className="term-value">₹{formatINR(loan.emi)}</span>
          </div>
          <div className="term-item">
            <span className="term-label">Disbursement Date</span>
            <span className="term-value">{formatDate(loan.disbursementDate)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
