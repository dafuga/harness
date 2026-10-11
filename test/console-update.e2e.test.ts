import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

interface Change {
	path: string;
	action: string;
	reason: string;
	before: { sha256: string; saved: string };
	after: { sha256: string } | null;
}
interface Installed {
	written: string[];
	kept: string[];
	changes: Change[];
}

let repo: VerifyRepo;
let endpoint = '';
const route = 'src/routes/harness/+server.ts';
const server = 'src/lib/server/harness/console.ts';
const hostOwned = 'export const GET = (): Response => new Response("written by the host");\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const install = ['console', 'install', '--host', '.', '--policy', '$lib/server/harnessPolicy'];
const json = async <Result>(args: string[]): Promise<Result> =>
	JSON.parse((await repo.run(args)).stdout) as Result;
const status = async () =>
	(await repo.git(['status', '--porcelain']))
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

// A host that already uses Harness: it has a unit registry, Git history and its own /harness route.
beforeAll(async () => {
	repo = await baselineRepo(async (project) => {
		await project.write('svelte.config.js', 'export default {};\n');
		await project.write(
			'src/lib/server/harnessPolicy.ts',
			'export function harnessPolicy(): boolean {\n\treturn false;\n}\n'
		);
		await project.write(route, hostOwned);
		await project.harness(['units', 'index', '--write']);
	});
	const directory = join(repo.root, 'specification/units');
	for (const file of await readdir(directory)) {
		const unit = await repo.json<{ id: string; owns: { source: string[] } }>(
			`specification/units/${file}`
		);
		if (unit.owns.source.includes(route)) endpoint = unit.id;
	}
}, 240_000);
afterAll(() => repo.dispose());

test('an install that would overwrite the host route stops and changes nothing', async () => {
	expect(endpoint).not.toBe('');
	const refused = await repo.run(install);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain(`${route} (host-owned: not written by harness console install)`);
	expect(refused.stderr).toContain('--update');
	expect(await status()).toEqual([]);
});

test('a requested update is a tracked change: saved, recorded, in the Git diff and in the impact', async () => {
	const updated = await json<Installed>([...install, '--update', '--json']);
	expect(updated.changes).toMatchObject([
		{
			path: route,
			action: 'replaced',
			reason: 'host-owned',
			before: { sha256: sha(hostOwned), saved: `.harness/console/replaced/${sha(hostOwned)}` }
		}
	]);
	expect(await repo.read(updated.changes[0].before.saved)).toBe(hostOwned);
	expect(await repo.read(route)).toContain('harness.entry(event');
	// Git shows the edit to the host's file next to the record that explains it.
	const changed = await status();
	expect(changed).toContain(`M ${route}`);
	expect(changed).toContain('?? harness.console.json');
	expect(await repo.git(['diff', '--stat', '--', route])).toContain('1 file changed');

	// The host's own registry sees it: the unit that owns the route changed and needs a reason.
	await repo.harness(['units', 'index', '--write']);
	const impact = await json<{ units: { direct: string[]; added: string[] } }>(['impact', '--json']);
	expect(impact.units.direct).toContain(endpoint);
	expect(impact.units.added.length).toBeGreaterThan(0);
	const reasons = await json<{ required: Array<{ unit: string; state: string }> }>([
		'explain',
		'list',
		'--json'
	]);
	const owed = reasons.required.filter((row) => row.unit === endpoint);
	expect(owed.length).toBeGreaterThan(0);
	expect(owed.every((row) => row.state === 'missing')).toBe(true);
	expect((await repo.run(['explain', 'check'])).exitCode).toBe(1);
	// Once the agent records why, the change passes the same gate as any other.
	await repo.explainAll();
	expect((await repo.run(['explain', 'check'])).exitCode).toBe(0);
}, 120_000);

test('later edits by the agent are kept or replaced on request, never lost', async () => {
	const tuned = `${await repo.read(server)}// tuned by the host agent\n`;
	await repo.write(server, tuned);
	const refused = await repo.run(install);
	expect(refused.exitCode).toBe(1);
	expect(refused.stderr).toContain(`${server} (edited since it was installed)`);
	expect(await repo.read(server)).toBe(tuned);

	const kept = await json<Installed>([...install, '--keep', '--json']);
	expect([kept.kept, kept.changes]).toEqual([[server], []]);
	expect(await repo.read(server)).toBe(tuned);

	const replaced = await json<Installed>([...install, '--update', '--json']);
	expect(replaced.changes).toMatchObject([
		{ path: server, action: 'replaced', reason: 'kept by the host', before: { sha256: sha(tuned) } }
	]);
	expect(await repo.read(replaced.changes[0].before.saved)).toBe(tuned);
	expect(await repo.read(server)).not.toBe(tuned);
});

test('restoring brings the host route back exactly, and repeated installs then leave it alone', async () => {
	const restored = await json<Change>(['console', 'restore', route, '--host', '.', '--json']);
	expect(restored).toMatchObject({
		path: route,
		action: 'restored',
		after: { sha256: sha(hostOwned) }
	});
	expect(await repo.read(route)).toBe(hostOwned);
	// The file is byte for byte what Git has committed again.
	expect(await repo.git(['diff', '--name-only', '--', route])).toBe('');
	const manifest = await repo.json<{
		changes: Change[];
		files: Array<{ path: string; owner: string }>;
	}>('harness.console.json');
	expect(manifest.changes.map((change) => [change.path, change.action])).toEqual([
		[route, 'replaced'],
		[server, 'replaced'],
		[route, 'restored']
	]);
	expect(manifest.files.find((file) => file.path === route)?.owner).toBe('host');
	for (const attempt of [1, 2]) {
		const again = await json<Installed>([...install, '--json']);
		expect([attempt, again.kept, again.changes]).toEqual([attempt, [route], []]);
	}
	expect(await repo.read(route)).toBe(hostOwned);
});

test('uninstalling removes what was generated, keeps the record, and the console installs again', async () => {
	const removed = await json<{ removed: string[]; kept: string[]; clean: boolean }>([
		'console',
		'uninstall',
		'--host',
		'.',
		'--json'
	]);
	expect(removed.removed).toContain(server);
	expect([removed.kept, removed.clean]).toEqual([[], false]);
	// Under src nothing generated is left and the host's own route is as Git has it.
	expect(await repo.git(['status', '--porcelain', '--', 'src'])).toBe('');
	expect(await repo.read(route)).toBe(hostOwned);
	const record = await repo.json<{ base?: string; changes: Change[] }>('harness.console.json');
	expect([record.base, record.changes.length]).toEqual([undefined, 3]);
	expect((await repo.run(['console', 'uninstall', '--host', '.'])).stderr).toContain(
		'No console is installed'
	);

	const again = await json<Installed>([...install, '--json']);
	expect(again.written).toContain(server);
	expect([again.kept, again.changes]).toEqual([[route], []]);
});
