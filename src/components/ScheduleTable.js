'use client';

const { formatINR, formatDate } = require('../lib/format.js');

export default function ScheduleTable({ schedule, touchedNumbers = [] }) {
  if (!schedule || schedule.length === 0) return null;

  const touchedSet = new Set(touchedNumbers);

  return (
    <section className="schedule-section">
      <h3 className="section-title">Repayment Schedule</h3>
      <div className="table-responsive-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th className="text-right">Principal</th>
              <th className="text-right">Interest</th>
              <th className="text-right">Total Due</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Remaining</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((item) => {
              const isOverdue = item.status === 'OVERDUE';
              const isTouched = touchedSet.has(item.number);

              let rowClass = '';
              if (isTouched) {
                rowClass = 'row-touched';
              } else if (isOverdue) {
                rowClass = 'row-overdue';
              }

              return (
                <tr key={item.number} className={rowClass}>
                  <td className="font-mono">{item.number}</td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td className="text-right font-mono">₹{formatINR(item.principalDue)}</td>
                  <td className="text-right font-mono">₹{formatINR(item.interestDue)}</td>
                  <td className="text-right font-mono">₹{formatINR(item.totalDue)}</td>
                  <td className="text-right font-mono">₹{formatINR(item.amountPaid)}</td>
                  <td className="text-right font-mono">₹{formatINR(item.remaining)}</td>
                  <td className="text-center">
                    <span className={`status-badge status-${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
