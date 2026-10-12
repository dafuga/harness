import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectRegistryService } from '../../src/services/ProjectRegistryService';
import { fixture } from '../project-fixture';
test('registered local projects persist distinct IDs and unknown IDs cannot select another root', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-registry-'));
	try {
		const a = await fixture(),
			b = await fixture();
		const registry = new ProjectRegistryService(join(directory, 'projects.json'));
		const first = await registry.register(a.root),
			second = await registry.register(b.root);
		expect(first.id).not.toBe(second.id);
		expect(await registry.register(a.root)).toEqual(first);
		const restored = new ProjectRegistryService(join(directory, 'projects.json'));
		expect(await restored.list()).toEqual([first, second]);
		expect((await restored.get(second.id)).root).toBe(b.root);
		await expect(restored.get('unknown')).rejects.toThrow('Unknown project');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}, 15000);
