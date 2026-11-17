import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

test('store writes bytes by their sha256 and read returns them', async () => {
	await withTempRepo(async ({ root }) => {
		const adapter = new LfsAdapter(root);
		const bytes = Buffer.from('hello');
		const stored = await adapter.store(bytes);
		const read = await adapter.read(stored.sha256);
		const missing = await adapter.read('0'.repeat(64));
		expect(stored).toEqual({
			sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
			bytes: 5
		});
		expect(read).toEqual(bytes);
		expect(missing).toBeUndefined();
		expect(stored.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
		recordExampleCases(
			{
				unitId: 'adapter.lfs',
				symbol: 'LfsAdapter.store and LfsAdapter.read',
				state: 'store-writes-bytes-by-their-sha256-and-read-returns-them',
				evidence: 'examples-cases',
				file: 'store-writes-bytes-by-their-sha256-and-read-returns-them.json'
			},
			[
				{
					name: 'hello is stored and read unchanged',
					input: { text: 'hello' },
					output: { stored, read: read?.toString('utf8') }
				},
				{
					name: 'unfetched object reads as undefined',
					input: { oid: '0'.repeat(64) },
					output: missing ?? null
				}
			]
		);
	});
});
