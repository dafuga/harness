import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { analyticsDisplay } from '../../src/utils/reports-media/analyticsDisplay';
test('first-try rate distinguishes no assessments from zero passes', () => {
	expect(analyticsDisplay(null)).toBe('No assessments');
	expect(analyticsDisplay(0)).toBe('0%');
	expect(analyticsDisplay(0.5)).toBe('50%');
});
test('the stub that re-exported analyticsDisplay from its old path is gone', () => {
	const stub = new URL('../../src/utils/analyticsDisplay.ts', import.meta.url);
	expect(existsSync(stub)).toBe(false);
});
