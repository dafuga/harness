import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { WorkingTreeAdapter } from '../../../src/adapters/git-source-history/WorkingTreeAdapter';
import { SnapshotAdapter } from '../../../src/adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import unit from '../../../specification/units/adapter.working-tree.json';
import { measureWorkload } from '../../support/measureWorkload';

const tracked = 'packages/desktop/ios/App/tracked.ts';
const generated = 'src/generated.ts';
const identity = ['-c', 'user.name=Harness Fixture', '-c', 'user.email=fixture@harness.invalid'];

async function put(root: string, path: string, text: string): Promise<void> {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), text);
}

async function repository(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'harness-working-tree-'));
	await put(root, '.gitignore', 'packages/desktop/ios/\n');
	await put(root, tracked, 'export const tracked = true;\n');
	const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
	git('init', '-q', '-b', 'main');
	git('add', '.gitignore');
	git('add', '-f', tracked);
	git(...identity, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'source');
	await put(root, 'src/untracked.ts', 'export const untracked = true;\n');
	await put(root, 'packages/desktop/ios/App/ignored.ts', 'ignored');
	return root;
}

test('list initialized preserves tracked snapshot source and excludes generated files', async () => {
	await measureWorkload(unit.id, 'tracked-snapshot-source', async () => {
		const root = await repository();
		const snapshot = await SnapshotAdapter.create(root, 'HEAD', []);
		try {
			const working = (await new WorkingTreeAdapter(root).list()).map((entry) => entry.path);
			expect(working).toContain(tracked);
			expect(working).toContain('src/untracked.ts');
			expect(working).not.toContain('packages/desktop/ios/App/ignored.ts');
			await put(snapshot.directory, generated, 'generated');
			vi.stubEnv('HARNESS_VERIFY_CASE_ROOT', snapshot.directory);
			const expected = unit.testing.cases[0].expected.value as {
				paths: string[];
				nested: string[];
			};
			const paths = (await new WorkingTreeAdapter(snapshot.directory).list()).map(
				(entry) => entry.path
			);
			expect(paths).toEqual(expected.paths);
			expect(paths).not.toContain(generated);
			const nested = (
				await new WorkingTreeAdapter(join(snapshot.directory, 'packages/desktop')).list()
			).map((entry) => entry.path);
			expect(nested).toEqual(expected.nested);
			const inventory = `${snapshot.directory}.tracked.json`;
			await writeFile(
				inventory,
				JSON.stringify({ root: snapshot.directory, files: ['../outside'] })
			);
			await expect(new WorkingTreeAdapter(snapshot.directory).list()).rejects.toThrow();
			expect((await snapshot.drift()).mutated).toContain('<snapshot-inventory>');
			await rm(inventory);
			await expect(new WorkingTreeAdapter(snapshot.directory).list()).rejects.toThrow();
		} finally {
			vi.unstubAllEnvs();
			await snapshot.remove();
			await rm(root, { recursive: true, force: true });
		}
	});
});

test('read initialized returns source and propagates missing-file errors', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-working-tree-read-'));
	try {
		await put(root, 'src/input.ts', 'hello');
		const reader = new WorkingTreeAdapter(root);
		expect(await reader.read('src/input.ts')).toEqual(unit.testing.cases[1].expected.value);
		await expect(reader.read('src/missing.ts')).rejects.toThrow();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
