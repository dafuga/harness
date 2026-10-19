import { test, expect } from 'vitest';
import { remoteCacheFixture } from '../remote-cache-fixture';
import { RemoteHttpProjectAdapter } from '../../src/adapters/remote-http-project-adapter/RemoteHttpProjectAdapter';
test('cached project discovery survives disconnect and cache deletion requires online rebuild', async () => {
	const f = await remoteCacheFixture();
	try {
		expect(await f.adapter.listProjects()).toEqual([{ id: 'p', name: 'Project', kind: 'shared' }]);
		await f.close();
		const restarted = new RemoteHttpProjectAdapter(f.options);
		expect(await restarted.listProjects()).toEqual([{ id: 'p', name: 'Project', kind: 'shared' }]);
		await f.cache.clear();
		await expect(restarted.listProjects()).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});
