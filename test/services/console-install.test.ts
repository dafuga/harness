import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { ConsoleInstallService } from '../../src/services/console-install-service/ConsoleInstallService';

let root: string;
let host: string;
const service = new ConsoleInstallService();
const policy = { policy: '$lib/server/harnessPolicy', policyExport: 'harnessPolicy' };
const options = () => ({ host, base: '/harness', ...policy });
const commit = 'a'.repeat(40);
const sha256 = 'b'.repeat(64);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-console-install-'));
	host = join(root, 'host');
	await mkdir(join(host, 'src/routes'), { recursive: true });
	await mkdir(join(host, 'src/lib/server'), { recursive: true });
	await writeFile(join(host, 'svelte.config.js'), 'export default {};\n');
	await writeFile(join(host, 'package.json'), '{"dependencies":{"@dafuga01/harness":"*"}}');
	await writeFile(
		join(host, 'src/lib/server/harnessPolicy.ts'),
		'export const harnessPolicy = () => false;\n'
	);
});
afterAll(() => rm(root, { recursive: true, force: true }));

async function index(media: string[]): Promise<string> {
	const directory = join(root, `index-${media.length}`);
	await mkdir(join(directory, 'revisions'), { recursive: true });
	await mkdir(join(directory, 'media'), { recursive: true });
	await writeFile(join(directory, 'index.json'), '{"revisions":[]}');
	await writeFile(join(directory, `revisions/${commit}.json`), '{}');
	for (const name of media) await writeFile(join(directory, 'media', name), 'bytes');
	return directory;
}

test('nothing is installed without a policy the host itself exports', async () => {
	await expect(service.install({ ...options(), policy: '$lib/server/missing' })).rejects.toThrow(
		'A host policy is required: $lib/server/missing does not exist'
	);
	await expect(service.install({ ...options(), policyExport: 'adminOnly' })).rejects.toThrow(
		'A host policy is required: $lib/server/harnessPolicy does not export adminOnly'
	);
	await expect(service.install({ ...options(), policy: '../policy' })).rejects.toThrow(
		'--policy must name a module under $lib'
	);
	await expect(service.install({ ...options(), base: '/a/b' })).rejects.toThrow('--base');
	await expect(service.install({ ...options(), host: root })).rejects.toThrow(
		'is not a SvelteKit project'
	);
	expect(existsSync(join(host, 'src/routes/harness'))).toBe(false);
	expect(existsSync(join(host, 'harness.console.json'))).toBe(false);
});

test('an install writes the routes, records them, and can be repeated or given new data', async () => {
	const first = await service.install({ ...options(), data: await index([`${sha256}.png`]) });
	expect(first.data).toEqual({ revisions: 1, media: 1, bytes: 23 });
	expect(first.warnings).toEqual([]);
	expect(first.written).toContain('src/routes/harness/+server.ts');
	expect(first.written).toContain(`src/lib/server/harness/data/media/${sha256}.png.ts`);
	const manifest = JSON.parse(await readFile(join(host, 'harness.console.json'), 'utf8')) as {
		policy: object;
		files: Array<{ path: string; sha256: string }>;
	};
	expect(manifest.policy).toEqual({ module: policy.policy, export: 'harnessPolicy' });
	expect(manifest.files.map((file) => file.path)).toEqual([...first.written].sort());

	// A later index without that media removes the module the first install wrote.
	const second = await service.install({ ...options(), data: await index([]) });
	expect(second.removed).toEqual([`src/lib/server/harness/data/media/${sha256}.png.ts`]);
	expect(existsSync(join(host, second.removed[0]))).toBe(false);
	expect(existsSync(join(host, 'src/routes/harness/+server.ts'))).toBe(true);
});

const route = 'src/routes/harness/+server.ts';
const hostOwned = 'export const GET = () => new Response("the host wrote this");\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const manifest = async () =>
	JSON.parse(await readFile(join(host, 'harness.console.json'), 'utf8')) as {
		files: Array<{ path: string; sha256: string; owner: string }>;
		changes: Array<{
			path: string;
			action: string;
			reason: string;
			before: { sha256: string; bytes: number; saved: string };
			after: { sha256: string; bytes: number } | null;
		}>;
	};
async function hostRoute(): Promise<void> {
	await mkdir(join(host, 'src/routes/harness'), { recursive: true });
	await writeFile(join(host, route), hostOwned);
}

test('a file the host owns is not replaced unasked, and nothing is written meanwhile', async () => {
	await hostRoute();
	await expect(service.install(options())).rejects.toThrow(
		`${route} (host-owned: not written by harness console install)`
	);
	await expect(service.install(options())).rejects.toThrow('--update');
	expect(await readFile(join(host, route), 'utf8')).toBe(hostOwned);
	expect(existsSync(join(host, 'harness.console.json'))).toBe(false);
	expect(existsSync(join(host, 'src/lib/server/harness/console.ts'))).toBe(false);
});

test('an intentional update replaces a host file, keeps what it replaced and records both', async () => {
	await hostRoute();
	const result = await service.install({ ...options(), update: true });
	const generated = await readFile(join(host, route), 'utf8');
	expect(generated).toContain('harness.entry(event');
	expect(result.changes).toEqual([
		{
			path: route,
			action: 'replaced',
			reason: 'host-owned',
			at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
			before: {
				sha256: sha(hostOwned),
				bytes: hostOwned.length,
				saved: `.harness/console/replaced/${sha(hostOwned)}`
			},
			after: { sha256: sha(generated), bytes: generated.length }
		}
	]);
	// The previous contents are recoverable byte for byte, and the record is in the project.
	expect(await readFile(join(host, result.changes[0].before.saved), 'utf8')).toBe(hostOwned);
	expect((await manifest()).changes).toEqual(result.changes);
	// Installing again changes nothing and records nothing new.
	const again = await service.install(options());
	expect(again.changes).toEqual([]);
	expect((await manifest()).changes).toHaveLength(1);
});

test('an edit made after an install is a change too: reported, then replaced or kept on request', async () => {
	await service.install(options());
	const edited = `${await readFile(join(host, route), 'utf8')}// tuned by the host agent\n`;
	await writeFile(join(host, route), edited);
	await expect(service.install(options())).rejects.toThrow(
		`${route} (edited since it was installed)`
	);
	expect(await readFile(join(host, route), 'utf8')).toBe(edited);

	const kept = await service.install({ ...options(), keep: true });
	expect([kept.kept, kept.changes]).toEqual([[route], []]);
	expect(await readFile(join(host, route), 'utf8')).toBe(edited);
	expect((await manifest()).files.find((file) => file.path === route)).toEqual({
		path: route,
		sha256: sha(edited),
		owner: 'host'
	});
	// A file the host keeps is left alone by later installs until an update is asked for.
	expect((await service.install(options())).kept).toEqual([route]);
	expect(await readFile(join(host, route), 'utf8')).toBe(edited);

	const updated = await service.install({ ...options(), update: true });
	expect(updated.changes).toMatchObject([
		{ path: route, action: 'replaced', reason: 'kept by the host', before: { sha256: sha(edited) } }
	]);
	expect(await readFile(join(host, route), 'utf8')).not.toBe(edited);
	expect((await manifest()).files.find((file) => file.path === route)?.owner).toBe('harness');
});

test('a replaced file can be restored, and the restore is recorded as well', async () => {
	await hostRoute();
	await service.install({ ...options(), update: true });
	const generated = await readFile(join(host, route), 'utf8');
	const restored = await service.restore(host, route);
	expect(await readFile(join(host, route), 'utf8')).toBe(hostOwned);
	expect(restored).toMatchObject({
		path: route,
		action: 'restored',
		before: { sha256: sha(generated), saved: `.harness/console/replaced/${sha(generated)}` },
		after: { sha256: sha(hostOwned) }
	});
	const recorded = await manifest();
	expect(recorded.changes.map((change) => change.action)).toEqual(['replaced', 'restored']);
	expect(recorded.files.find((file) => file.path === route)?.owner).toBe('host');
	// The restored file is the host's again, so an ordinary install leaves it in place.
	expect((await service.install(options())).kept).toEqual([route]);
	await expect(service.restore(host, 'src/routes/+page.svelte')).rejects.toThrow(
		'No replaced contents are recorded for src/routes/+page.svelte'
	);
});

test('a generated file that was edited is not silently removed with stale data', async () => {
	const media = `src/lib/server/harness/data/media/${sha256}.png.ts`;
	await service.install({ ...options(), data: await index([`${sha256}.png`]) });
	await writeFile(join(host, media), 'export default "edited";\n');
	const without = await index([]);
	await expect(service.install({ ...options(), data: without })).rejects.toThrow(
		`${media} (edited since it was installed)`
	);
	const updated = await service.install({ ...options(), data: without, update: true });
	expect(updated.removed).toEqual([media]);
	expect(updated.changes).toMatchObject([{ path: media, action: 'removed', after: null }]);
	expect(await readFile(join(host, updated.changes[0].before.saved), 'utf8')).toBe(
		'export default "edited";\n'
	);
});

test('a host that lacks the package, or an index that is not one, is reported', async () => {
	await writeFile(join(host, 'package.json'), '{}');
	const installed = await service.install(options());
	expect(installed.data).toBeNull();
	expect(installed.warnings).toEqual([
		'@dafuga01/harness is not a dependency of the host yet; add it before building.'
	]);
	await expect(service.install({ ...options(), data: root })).rejects.toThrow(
		'is not a history index'
	);
});
