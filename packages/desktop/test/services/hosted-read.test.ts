import { test, expect } from 'vitest';
import { HostedReadService } from '../../src/services/HostedReadService';
test('missing native credentials never execute a cached or online load', async () => {
	const events: unknown[] = [];
	const service = new HostedReadService({
		onCacheStatus: (event) => events.push(event),
		origin: 'https://example.com',
		credentials: async () => null
	});
	let loaded = false;
	await expect(
		service.read(
			{ projectId: 'p', key: 'snapshot' },
			async () => {
				loaded = true;
				return { value: 'secret' };
			},
			String
		)
	).rejects.toThrow('session');
	expect(loaded).toBe(false);
	expect(events).toEqual([{ projectId: '$projects', status: 'denied' }]);
});
