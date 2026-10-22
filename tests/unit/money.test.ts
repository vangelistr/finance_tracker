import { describe, expect, it } from 'vitest';
import { allocate, applyBps, formatMoney, parseMoney, toInputValue } from '@/lib/money';

describe('parseMoney', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['12,5', 1250],
    ['7', 700],
    ['€ 7', 700],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1 234,56', 123456],
    ['-3,20', -320],
    ['−3,20', -320],
    [',99', 99],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345,6', '1.2.3', '--1', '1e5', '1,2345'])('rejects %s', (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats Greek euros with a true minus sign', () => {
    expect(formatMoney(-123456, 'EUR', 'el-GR')).toMatch(/^−1\.234,56\s€$/);
  });
  it('formats English euros', () => {
    expect(formatMoney(123456, 'EUR', 'en-IE')).toBe('€1,234.56');
  });
  it('round-trips input values', () => {
    expect(parseMoney(toInputValue(-1205, 'el-GR'))).toBe(-1205);
    expect(toInputValue(5, 'en')).toBe('0.05');
  });
});

describe('applyBps', () => {
  it('rounds half away from zero', () => {
    expect(applyBps(1001, 2400)).toBe(240);
    expect(applyBps(1000, 2450)).toBe(245);
    expect(applyBps(-1000, 2450)).toBe(-245);
    expect(applyBps(3, 5000)).toBe(2);
  });
});

describe('allocate', () => {
  it('always sums to the total', () => {
    for (const total of [0, 1, 99, 100, 101, 12345, -7777]) {
      const parts = allocate(total, [50, 30, 20]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it('splits proportionally with largest remainder', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [50, 30, 20])).toEqual([500, 300, 200]);
  });
  it('handles zero weights', () => {
    expect(allocate(10, [0, 0])).toEqual([10, 0]);
    expect(allocate(10, [])).toEqual([]);
  });
});
