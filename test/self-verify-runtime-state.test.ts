import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type * as FileSystem from 'node:fs/promises';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { SnapshotAdapter } from '../src/adapters/snapshot-adapter/SnapshotAdapter';
import { verifyConfigSchema } from '../src/core/verifyTypes';
import unit from '../specification/units/adapter.snapshot.json';
import { measureWorkload } from './support/measureWorkload';

const allocation = vi.hoisted(() => ({ next: '' }));
vi.mock('node:fs/promises', async (load) => {
	const actual = await load<typeof FileSystem>();
	return {
		...actual,
		mkdtemp: (...args: unknown[]) => {
			if (!allocation.next) return Reflect.apply(actual.mkdtemp, undefined, args);
			const directory = allocation.next;
			allocation.next = '';
			return Promise.resolve(directory);
		}
	};
});

/**
 * What the Hub browser tests left in the clean snapshot of 8f7e422: their dev server emulates
 * Cloudflare locally, and that emulation keeps its D1, R2 and cache state beside the package.
 */
const stores = [
	'cache/miniflare-CacheObject',
	'd1/miniflare-D1DatabaseObject',
	'r2/miniflare-R2BucketObject'
];
const runtimeState = stores.flatMap((store) =>
	['', '-shm', '-wal'].map(
		(suffix) => `packages/hub/.wrangler/state/v3/${store}/metadata.sqlite${suffix}`
	)
);
/** Not that state: beside it, ignored by Git, named like it, or in another package. */
const undeclared = [
	'.wrangler/state/v3/d1/metadata.sqlite',
	'packages/desktop/.wrangler/state/v3/d1/metadata.sqlite',
	'packages/hub/.dev.vars',
	'packages/hub/.env.local',
	'packages/hub/.wrangler/deploy/config.json',
	'packages/hub/.wrangler/state.json',
	'packages/hub/.wrangler/tmp/bundle.js',
	'packages/hub/.wranglerx/state/v3/d1/metadata.sqlite',
	'packages/hub/metadata.sqlite',
	'packages/hub/src/generated.ts',
	'packages/relay/.wrangler/state/v3/do/metadata.sqlite'
];
const tracked = ['packages/hub/src/app.ts', 'packages/hub/wrangler.jsonc'];
const identity = ['-c', 'user.name=Harness Fixture', '-c', 'user.email=fixture@harness.invalid'];
const made: Array<() => Promise<void>> = [];
afterEach(async () => {
	await Promise.all(made.splice(0).map((remove) => remove()));
});

const declared = (): string[] =>
	verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8'))).outputs;
async function put(root: string, path: string, content = path): Promise<void> {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), content);
}
/** A clean export of a commit that holds Hub source, guarded by this repository's own outputs. */
async function hubSnapshot(extraTracked: string[] = []): Promise<SnapshotAdapter> {
	const root = await mkdtemp(join(tmpdir(), 'harness-hub-state-'));
	made.push(() => rm(root, { recursive: true, force: true }));
	for (const path of [...tracked, ...extraTracked]) await put(root, path);
	const git = (...given: string[]) => execFileSync('git', given, { cwd: root, stdio: 'pipe' });
	git('init', '-q', '-b', 'main');
	git('add', '.');
	git(...identity, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'hub');
	const snapshot = await SnapshotAdapter.create(root, 'HEAD', declared());
	made.push(() => snapshot.remove());
	return snapshot;
}

function expected(index: number): unknown {
	const value = unit.testing.cases[index].expected;
	return 'value' in value ? value.value : undefined;
}

test('create initialized exports the committed source and cleans up failed creation', async () => {
	const snapshot = await hubSnapshot(['packages/desktop/ios/App/tracked.ts']);
	expect({
		repository: existsSync(join(snapshot.directory, '.git')),
		tracked: await readFile(join(snapshot.directory, 'packages/desktop/ios/App/tracked.ts'), 'utf8')
	}).toEqual(expected(0));
	const parent = await mkdtemp(join(tmpdir(), 'harness-snapshot-failure-'));
	try {
		vi.stubEnv('TMPDIR', parent);
		await expect(SnapshotAdapter.create(snapshot.directory, 'missing', [])).rejects.toThrow();
		expect(await readdir(parent)).toEqual([]);
	} finally {
		vi.unstubAllEnvs();
		await rm(parent, { recursive: true, force: true });
	}
	await assertUnownedInventory(snapshot);
});

async function assertUnownedInventory(snapshot: SnapshotAdapter): Promise<void> {
	const parent = await mkdtemp(join(tmpdir(), 'harness-inventory-owner-'));
	const directory = join(parent, 'harness-snapshot-fixed');
	const inventory = `${directory}.tracked.json`;
	await mkdir(directory);
	await writeFile(inventory, 'pre-existing');
	allocation.next = directory;
	try {
		await expect(SnapshotAdapter.create(snapshot.directory, 'missing', [])).rejects.toThrow();
		expect(allocation.next).toBe('');
		expect(existsSync(inventory), 'pre-existing inventory').toBe(true);
		expect(await readFile(inventory, 'utf8')).toBe('pre-existing');
	} finally {
		allocation.next = '';
		await rm(parent, { recursive: true, force: true });
	}
}

test('link initialized shares an existing path only once', async () => {
	const snapshot = await hubSnapshot();
	const source = await mkdtemp(join(tmpdir(), 'harness-snapshot-link-'));
	made.push(() => rm(source, { recursive: true, force: true }));
	await put(source, 'shared.txt', 'shared');
	expect(await snapshot.link(source, 'shared.txt')).toEqual(expected(1));
	expect(await readFile(join(snapshot.directory, 'shared.txt'), 'utf8')).toBe('shared');
	expect(await snapshot.link(source, 'shared.txt')).toBe(false);
	expect(await snapshot.link(source, 'missing.txt')).toBe(false);
});

test('misdeclared initialized rejects outputs covering tracked source', async () => {
	const about = declared().filter((output) => output.includes('wrangler'));
	expect(about).toEqual(['packages/hub/.wrangler/state/']);
	expect((await hubSnapshot()).misdeclared()).toEqual(expected(2));
	const file = runtimeState[0];
	const invalid = await hubSnapshot([file]);
	expect(invalid.misdeclared()).toEqual([{ output: about[0], file }]);
	await put(invalid.directory, file, 'modified tracked state');
	expect((await invalid.drift()).mutated).toEqual([file]);
});

test('drift initialized detects changed source and undeclared additions', async () => {
	await measureWorkload(unit.id, 'snapshot-drift-boundaries', async () => {
		const snapshot = await hubSnapshot();
		for (const path of runtimeState) await put(snapshot.directory, path);
		expect(await snapshot.drift()).toEqual(expected(3));
		for (const path of undeclared) await put(snapshot.directory, path);
		expect(await snapshot.drift()).toEqual({ mutated: [], added: [...undeclared].sort() });
		const changed = await hubSnapshot();
		await put(changed.directory, 'packages/hub/src/app.ts', 'changed by a check');
		await rm(join(changed.directory, 'packages/hub/wrangler.jsonc'));
		const drift = await changed.drift();
		expect(drift.mutated).toEqual(['packages/hub/src/app.ts', 'packages/hub/wrangler.jsonc']);
		expect(drift.added).toEqual([]);
	});
});

test('artifact initialized measures files inside the snapshot', async () => {
	const snapshot = await hubSnapshot();
	await put(snapshot.directory, 'artifact.bin', 'data');
	expect(await snapshot.artifact('artifact.bin')).toEqual(expected(4));
	expect(await snapshot.artifact('../outside')).toBeUndefined();
});

test('remove initialized clears the exported snapshot and inventory', async () => {
	const snapshot = await hubSnapshot();
	await expect(snapshot.remove()).resolves.toBeUndefined();
	expect(existsSync(snapshot.directory)).toBe(false);
	expect(existsSync(`${snapshot.directory}.tracked.json`)).toBe(false);
	await expect(snapshot.remove()).resolves.toBeUndefined();
});
