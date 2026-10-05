const { isValidISODate, addMonthsClamped } = require('../../src/lib/dates.js');
const { ApiError } = require('../../src/lib/errors.js');

describe('Date Utilities', () => {
  test('validates ISO dates and adds months with clamping without drift', () => {
    // Validation
    expect(isValidISODate('2026-01-31')).toBe(true);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('invalid-date')).toBe(false);

    // Month addition with clamping (no drift)
    const baseDate = '2026-01-31';
    expect(addMonthsClamped(baseDate, 1)).toBe('2026-02-28');
    expect(addMonthsClamped(baseDate, 2)).toBe('2026-03-31');
    expect(addMonthsClamped(baseDate, 3)).toBe('2026-04-30');

    // Leap year handling
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');

    // Invalid date input throws ApiError
    expect(() => addMonthsClamped('2026-02-30', 1)).toThrow(ApiError);
  });
});
