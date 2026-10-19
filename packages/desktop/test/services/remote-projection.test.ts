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

test('unchanged account discovery does not fetch every project snapshot again', async () => {
	const f = await remoteCacheFixture();
	try {
		await f.adapter.listProjects();
		f.state.calls.length = 0;
		expect(await f.adapter.listProjects()).toEqual([{ id: 'p', name: 'Project', kind: 'shared' }]);
		expect(
			f.state.calls.filter((path) => path.includes('/snapshot')),
			'project discovery stays lightweight'
		).toEqual([]);
	} finally {
		await f.cleanup();
	}
});

test('a removed membership cannot reappear from this devices cached projects or entities', async () => {
	const f = await remoteCacheFixture();
	const input = { projectId: 'p', commit: 'a'.repeat(40), entityId: 'entity' };
	try {
		await f.adapter.listProjects();
		await f.adapter.entity(input);
		f.state.projects = [];
		expect(await f.adapter.listProjects()).toEqual([]);
		await f.close();
		await expect(f.adapter.entity(input), 'removed project copies are purged').rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});
