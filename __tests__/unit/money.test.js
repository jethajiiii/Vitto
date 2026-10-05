const { toPaise, toRupeesString, formatINR } = require('../../src/lib/money.js');
const { ApiError } = require('../../src/lib/errors.js');

describe('Money Utilities', () => {
  test('converts valid inputs to paise and rejects invalid inputs', () => {
    // Valid conversions
    expect(toPaise('19.99')).toBe(1999);
    expect(toPaise('0.1')).toBe(10);
    expect(toPaise(5)).toBe(500);
    expect(toPaise('0')).toBe(0);

    // Rupee formatting
    expect(toRupeesString(998461)).toBe('9984.61');
    expect(formatINR(998461)).toContain('9,984.61');

    // Invalid conversions rejected with ApiError VALIDATION_ERROR
    const invalidInputs = ['-5', 'abc', '1.234', '', null, NaN];
    invalidInputs.forEach((input) => {
      expect(() => toPaise(input)).toThrow(ApiError);
      try {
        toPaise(input);
      } catch (err) {
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
