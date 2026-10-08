import { expect, test } from 'vitest';
import { analyticsDisplay } from '../../src/utils/analyticsDisplay';
test('first-try rate distinguishes no assessments from zero passes', () => {
	expect(analyticsDisplay(null)).toBe('No assessments');
	expect(analyticsDisplay(0)).toBe('0%');
	expect(analyticsDisplay(0.5)).toBe('50%');
});
