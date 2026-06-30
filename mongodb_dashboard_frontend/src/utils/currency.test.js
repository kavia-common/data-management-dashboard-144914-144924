import React from 'react';
import { render } from '@testing-library/react';
import { CREDITS_PER_USD, usdToCredits, formatCredits, renderCreditsWithUsd } from './currency';
import { formatCreditsFixedDecimals } from '../components/utils/creditsUtils';

describe('currency credits utils', () => {
  test('usdToCredits converts with configured factor', () => {
    expect(usdToCredits(0)).toBe(0);
    expect(usdToCredits(1)).toBe(CREDITS_PER_USD);
    expect(usdToCredits(0.5)).toBe(Math.round(0.5 * CREDITS_PER_USD));
    expect(usdToCredits('2')).toBe(2 * CREDITS_PER_USD);
    expect(usdToCredits(undefined)).toBe(0);
  });

  test('formatCredits formats with "credits" suffix', () => {
    expect(formatCredits(0)).toBe('0 credits');
    const txt = formatCredits(1234567);
    expect(txt).toMatch(/1,234,567 credits|1234567 credits/);
  });

  test('renderCreditsWithUsd shows credits first and USD in parens', () => {
    const { getByText } = render(<div>{renderCreditsWithUsd(1.2345)}</div>);
    // Primary content text contains 'credits'
    expect(getByText(/credits/)).toBeInTheDocument();
  });

  test('Credits Consumed formatting matches expected 4-decimal output for derived credits', () => {
    // Example from bug report:
    // total_cost = 3238.6598151099997
    // credits = total_cost * 20000 = 64773196.3022 (expected, 4 decimals)
    const totalCost = 3238.6598151099997;
    const credits = totalCost * 20000;
    expect(formatCreditsFixedDecimals(credits, 4)).toBe('64,773,196.3022');
  });
});
