import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { SnapshotAdapter } from '../src/adapters/SnapshotAdapter';
import { verifyConfigSchema } from '../src/core/verifyTypes';

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

test('the local Cloudflare state of the Hub dev server is a declared output', async () => {
	const snapshot = await hubSnapshot();
	for (const path of runtimeState) await put(snapshot.directory, path);
	expect(await snapshot.drift()).toEqual({ mutated: [], added: [] });
	expect(snapshot.misdeclared()).toEqual([]);
});

test('exactly that state is declared, and tracked state is rejected by the exported snapshot', async () => {
	const about = declared().filter((output) => output.includes('wrangler'));
	expect(about).toEqual(['packages/hub/.wrangler/state/']);
	expect((await hubSnapshot()).misdeclared()).toEqual([]);
	const file = runtimeState[0];
	const invalid = await hubSnapshot([file]);
	expect(invalid.misdeclared()).toEqual([{ output: about[0], file }]);
	await put(invalid.directory, file, 'modified tracked state');
	expect((await invalid.drift()).mutated).toEqual([file]);
});

test('any other file a check leaves still fails: beside the state, ignored, or elsewhere', async () => {
	const snapshot = await hubSnapshot();
	for (const path of undeclared) await put(snapshot.directory, path);
	expect(await snapshot.drift()).toEqual({ mutated: [], added: [...undeclared].sort() });
});

test('changed or removed Hub source still fails, whatever else is declared', async () => {
	const snapshot = await hubSnapshot();
	await put(snapshot.directory, 'packages/hub/src/app.ts', 'changed by a check');
	await rm(join(snapshot.directory, 'packages/hub/wrangler.jsonc'));
	const drift = await snapshot.drift();
	expect(drift.mutated).toEqual(['packages/hub/src/app.ts', 'packages/hub/wrangler.jsonc']);
	expect(drift.added).toEqual([]);
});
