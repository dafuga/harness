import { test, expect, vi } from 'vitest';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { fixture, git } from '../project-fixture';
import { ProjectSessionService } from '../../src/services/ProjectSessionService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { ProjectImageCacheService } from '../../src/services/ProjectImageCacheService';
test('real image reads revalidate project ownership and rebuild corrupt cache without changing canonical bytes', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-image-cache-'));
	try {
		const f = await fixture();
		const plan = await f.planning.createPlan({
			category: 'pages',
			title: 'Image cache',
			goal: 'Cache real committed bytes'
		});
		const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
		const version = await f.planning.addDesign({
			entityId: plan.id,
			prompt: 'fixture',
			generator: { provider: 'codex', model: 'fixture' },
			baseRevision: f.tip,
			state: 'default',
			viewport: 'desktop',
			bytes
		});
		const commit = git(f.root, 'rev-parse', 'HEAD');
		const session = new ProjectSessionService({ cache: new ProjectionCacheService(root) });
		await session.open(f.root);
		const read = vi.spyOn(session.planning!, 'image');
		const reader = new ProjectImageCacheService(session);
		const query = {
			projectId: session.projectId!,
			entityId: plan.id,
			commit,
			version: version.version,
			sha256: version.images[0].sha256
		};
		expect(await reader.read(query)).toEqual(new Uint8Array(bytes));
		expect(await reader.read(query)).toEqual(new Uint8Array(bytes));
		expect(read).toHaveBeenCalledTimes(1);
		const [entry] = await readdir(root);
		await writeFile(join(root, entry), 'corrupt cache');
		expect(await reader.read(query)).toEqual(new Uint8Array(bytes));
		expect(read).toHaveBeenCalledTimes(2);
		await expect(reader.read({ ...query, entityId: 'unknown' })).rejects.toThrow();
		expect(git(f.root, 'rev-parse', 'HEAD')).toBe(commit);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 15000);
