import { expect, test } from 'vitest';
import { reportRetention } from '../../src/utils/reportRetention';
test('expiry includes the exact 30-day boundary and rejects unknown dates', () => {
	const startedAt = '2026-10-01T00:00:00.000Z';
	const boundary = Date.parse('2026-10-31T00:00:00.000Z');
	expect(reportRetention({ startedAt }, boundary - 1)).toBe(false);
	expect(reportRetention({ startedAt }, boundary)).toBe(true);
	expect(() => reportRetention({ startedAt: 'unknown' }, boundary)).toThrow('timestamp');
});
