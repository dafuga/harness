import { expect, test } from 'vitest';
import { normalizeFilter } from '../../src/services/AnalyticsService';
test('date filters reject invalid input and normalize ISO dates', async () => {
	await expect(normalizeFilter({ since: 'invalid' })).rejects.toThrow('Invalid --since');
	expect(await normalizeFilter({ since: '2026-10-06' })).toEqual({
		since: '2026-10-06T00:00:00.000Z'
	});
});

test('an inclusive end date includes the full UTC day', async () => {
	expect(await normalizeFilter({ until: '2026-10-06' })).toEqual({
		until: '2026-10-06T23:59:59.999Z'
	});
});
