import { test, expect, vi } from 'vitest';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { fixture, git } from '../project-fixture';
import { ProjectSessionService } from '../../src/services/ProjectSessionService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { ProjectImageCacheService } from '../../src/services/ProjectImageCacheService';
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
}
async function switchedProjectReads(
	f: Awaited<ReturnType<typeof fixture>>,
	session: ProjectSessionService,
	reader: ProjectImageCacheService,
	{ query, bytes }: { query: Parameters<ProjectImageCacheService['read']>[0]; bytes: Buffer }
) {
	const other = await fixture();
	const cache = session.cache!;
	const get = vi.spyOn(cache, 'get');
	const put = vi.spyOn(cache, 'put');
	try {
		const hitStarted = deferred<void>();
		const hitRelease = deferred<Uint8Array>();
		get.mockImplementationOnce(async () => {
			hitStarted.resolve();
			return hitRelease.promise;
		});
		const hit = reader.read(query).then(
			() => 'returned',
			() => 'rejected'
		);
		await hitStarted.promise;
		await session.open(other.root);
		hitRelease.resolve(new Uint8Array(bytes));
		const hitResult = await hit;

		await session.open(f.root);
		const imageStarted = deferred<void>();
		const imageRelease = deferred<void>();
		get.mockResolvedValueOnce(null);
		vi.spyOn(session.planning!, 'image').mockImplementationOnce(async () => {
			imageStarted.resolve();
			await imageRelease.promise;
			return new Uint8Array(bytes);
		});
		const miss = reader.read(query).then(
			() => 'returned',
			() => 'rejected'
		);
		await imageStarted.promise;
		await session.open(other.root);
		put.mockClear();
		imageRelease.resolve();
		const missResult = await miss;
		expect([hitResult, missResult, put.mock.calls.length]).toEqual(['rejected', 'rejected', 0]);
	} finally {
		get.mockRestore();
		put.mockRestore();
		await rm(other.root, { recursive: true, force: true });
	}
}
async function optionReads(
	f: Awaited<ReturnType<typeof fixture>>,
	reader: ProjectImageCacheService,
	input: { query: Parameters<ProjectImageCacheService['read']>[0]; bytes: Buffer },
	calls: () => unknown[][]
) {
	const { query, bytes } = input;
	const second = PNG.sync.write(new PNG({ width: 3, height: 3 }));
	const options = await f.planning.addDesign({
		entityId: query.entityId,
		prompt: 'two options',
		generator: { provider: 'codex', model: 'fixture' },
		baseRevision: query.commit,
		state: 'default',
		viewport: 'desktop',
		bytes: null,
		options: [
			{ direction: 'First', prompt: 'First', revisedPrompt: null, bytes },
			{ direction: 'Second', prompt: 'Second', revisedPrompt: null, bytes: second }
		]
	});
	const optionCommit = git(f.root, 'rev-parse', 'HEAD');
	const first = options.images.find((image) => image.option === 'o1');
	if (!first) throw new Error('The first option image was not committed.');
	const optionQuery = {
		...query,
		commit: optionCommit,
		version: options.version,
		sha256: first.sha256,
		option: 'o1'
	};
	expect(await reader.read(optionQuery)).toEqual(new Uint8Array(bytes));
	expect(calls().at(-1)?.[0]).toMatchObject({ option: 'o1', revision: optionCommit });
	expect(await reader.read(optionQuery)).toEqual(new Uint8Array(bytes));
	const other = options.images.find((image) => image.option === 'o2');
	if (!other) throw new Error('The second option image was not committed.');
	expect(await reader.read({ ...optionQuery, sha256: other.sha256, option: 'o2' })).toEqual(
		new Uint8Array(second)
	);
	const beforeMismatch = calls().length;
	await expect(reader.read({ ...optionQuery, option: 'o2' })).rejects.toThrow();
	expect(calls()).toHaveLength(beforeMismatch);
	expect(await reader.read({ ...optionQuery, option: undefined })).toEqual(new Uint8Array(bytes));
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(optionCommit);
}
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
		await optionReads(f, reader, { query, bytes }, () => read.mock.calls);
		await switchedProjectReads(f, session, reader, { query, bytes });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 30000);
