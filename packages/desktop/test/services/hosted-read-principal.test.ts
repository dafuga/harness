import { expect, test } from 'vitest';
import { HostedReadService } from '../../src/services/HostedReadService';

test('an artifact response principal is checked even before metadata was pinned', async () => {
	const origin = 'https://hub.example.invalid';
	const reads = new HostedReadService({
		origin,
		credentials: async () => ({ origin, principalId: 'alice', token: 'private' })
	});
	await expect(
		reads.read(
			{ projectId: 'p', key: 'artifact' },
			async () => ({ value: 'bytes', principalId: 'bob' }),
			String
		)
	).rejects.toThrow('Hosted cache identity mismatch.');
});
