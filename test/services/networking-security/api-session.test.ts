import { expect, test, vi } from 'vitest';
import { join } from 'node:path';
import { HarnessApiService } from '../../../src/services/networking-security/HarnessApiService';
import { apiFixture, commit } from '../../support/api-cli/apiFixture';

test('concurrent API clients share one local session without losing a started run', async () => {
	const f = await apiFixture('local');
	vi.stubEnv('HARNESS_API_HOME', join(f.directory, 'sessions'));
	try {
		const first = new HarnessApiService({ url: f.origin, mode: 'local' });
		const second = new HarnessApiService({ url: f.origin, mode: 'local' });
		const snapshots = await Promise.all([first.snapshot(), second.snapshot()]);
		expect(snapshots.map((snapshot) => snapshot.revision.commit)).toEqual([commit, commit]);
		expect(f.seen.filter((request) => request.operation === 'connect')).toHaveLength(1);
		expect(f.sessionFiles()).toHaveLength(1);
	} finally {
		vi.unstubAllEnvs();
		await f.close();
	}
});
