import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { ConsoleInstallService } from '../../src/services/console-install-service/ConsoleInstallService';
import { ConsoleUninstallService } from '../../src/services/ConsoleUninstallService';

let root: string;
let host: string;
const installer = new ConsoleInstallService();
const remover = new ConsoleUninstallService();
const options = () => ({
	host,
	base: '/harness',
	policy: '$lib/server/harnessPolicy',
	policyExport: 'harnessPolicy'
});
const page = 'src/routes/harness/+server.ts';
const own = "export const GET = (): Response => new Response('The host wrote this page.');\n";
const manifest = () => join(host, 'harness.console.json');

/** Every file of the host with its content, so two states can be compared exactly. */
async function snapshot(): Promise<Record<string, string>> {
	const entries = await readdir(host, { recursive: true, withFileTypes: true });
	const files = entries.filter((entry) => entry.isFile());
	const pairs = await Promise.all(
		files.map(async (entry) => {
			const path = join(entry.parentPath, entry.name);
			return [path.slice(host.length + 1), await readFile(path, 'utf8')] as const;
		})
	);
	return Object.fromEntries(pairs.sort(([left], [right]) => (left < right ? -1 : 1)));
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-console-uninstall-'));
	host = join(root, 'host');
	await mkdir(join(host, 'src/routes'), { recursive: true });
	await mkdir(join(host, 'src/lib/server'), { recursive: true });
	await writeFile(join(host, 'svelte.config.js'), 'export default {};\n');
	await writeFile(join(host, 'package.json'), '{"dependencies":{"@dafuga01/harness":"*"}}');
	await writeFile(
		join(host, 'src/lib/server/harnessPolicy.ts'),
		'export const harnessPolicy = () => false;\n'
	);
	const index = join(root, 'index');
	await mkdir(join(index, 'revisions'), { recursive: true });
	await writeFile(join(index, 'index.json'), '{"revisions":[]}');
	await writeFile(join(index, `revisions/${'a'.repeat(40)}.json`), '{}');
});
afterAll(() => rm(root, { recursive: true, force: true }));

test('an uninstall leaves the host exactly as it was, and installing again gives the same files', async () => {
	const before = await snapshot();
	const first = await installer.install({ ...options(), data: join(root, 'index') });
	const installed = await snapshot();
	// Installing over an unchanged install changes nothing.
	const again = await installer.install({ ...options(), data: join(root, 'index') });
	expect([again.removed, again.changes, again.kept]).toEqual([[], [], []]);
	expect(await snapshot()).toEqual(installed);

	const removed = await remover.uninstall({ host });
	expect(removed.removed.sort()).toEqual([...first.written].sort());
	expect([removed.restored, removed.kept, removed.changes, removed.clean]).toEqual([
		[],
		[],
		[],
		true
	]);
	expect(await snapshot()).toEqual(before);
	expect(existsSync(join(host, 'src/routes/harness'))).toBe(false);
	expect(existsSync(join(host, 'src/lib/server/harness'))).toBe(false);
	expect(existsSync(manifest())).toBe(false);

	await installer.install({ ...options(), data: join(root, 'index') });
	expect(await snapshot()).toEqual(installed);
	await expect(remover.uninstall({ host: root })).rejects.toThrow('No console is installed');
});

test('what an install replaced is put back, and the record of both changes stays', async () => {
	await writeFile(join(host, page), own, { flag: 'w' }).catch(async () => {
		await mkdir(join(host, 'src/routes/harness'), { recursive: true });
		await writeFile(join(host, page), own);
	});
	await installer.install({ ...options(), update: true });
	expect(await readFile(join(host, page), 'utf8')).toContain('harness.entry');
	const removed = await remover.uninstall({ host });
	expect(removed.restored).toEqual([page]);
	expect(await readFile(join(host, page), 'utf8')).toBe(own);
	expect(removed.clean).toBe(false);
	const kept = JSON.parse(await readFile(manifest(), 'utf8')) as {
		base?: string;
		files: Array<{ path: string; owner: string }>;
		changes: Array<{ path: string; action: string }>;
	};
	expect(kept.base).toBeUndefined();
	expect(kept.files).toEqual([{ path: page, sha256: expect.any(String), owner: 'host' }]);
	expect(kept.changes.map((change) => [change.path, change.action])).toEqual([
		[page, 'replaced'],
		[page, 'restored']
	]);
});

test('a generated file the host edited is never removed without being asked', async () => {
	await installer.install(options());
	const edited = 'src/routes/harness/data/[...path]/+server.ts';
	await writeFile(join(host, edited), '// The host changed this endpoint.\n');
	await expect(remover.uninstall({ host })).rejects.toThrow(
		/1 file was edited since it was installed:\n {2}src\/routes\/harness\/data\/\[\.\.\.path\]\/\+server\.ts\nRun again with --update .* Or with --keep /
	);
	expect(existsSync(join(host, page))).toBe(true);

	const left = await remover.uninstall({ host, keep: true });
	expect([left.kept, left.clean]).toEqual([[edited], false]);
	expect(await readFile(join(host, edited), 'utf8')).toBe('// The host changed this endpoint.\n');
	expect(existsSync(join(host, page))).toBe(false);

	await installer.install({ ...options(), update: true });
	await writeFile(join(host, edited), '// Edited again.\n');
	const taken = await remover.uninstall({ host, update: true });
	expect(taken.changes).toMatchObject([{ path: edited, action: 'removed', after: null }]);
	expect(await readFile(join(host, taken.changes[0].before.saved), 'utf8')).toBe(
		'// Edited again.\n'
	);
	expect(existsSync(join(host, edited))).toBe(false);
});
