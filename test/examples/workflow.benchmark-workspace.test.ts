import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import {
	benchmarkFiles,
	benchmarkFileValue,
	benchmarkGit,
	createBenchmarkWorkspace,
	overlayBenchmarkFiles,
	regularBenchmarkFile,
	snapshotBenchmark
} from '../../src/cli/program/benchmark-service/benchmarkWorkspace';

const unitId = 'workflow.benchmark-workspace';

function record(symbol: string, state: string, input: unknown, output: unknown): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: state, input, output }]
	);
}

test('Lists and snapshots a committed benchmark tree', async () => {
	await withTempRepo(async ({ root, git }) => {
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src', 'sample.ts'), 'export const value = 1;\n');
		git('add', 'src/sample.ts');
		git('commit', '-m', 'sample');
		const revision = git('rev-parse', 'HEAD');
		const files = await benchmarkFiles(root, revision);
		const destination = join(root, 'snapshot');
		const snapshot = await snapshotBenchmark(root, revision, destination);
		expect(files).toContain('src/sample.ts');
		expect(await readFile(join(destination, 'src', 'sample.ts'), 'utf8')).toContain('value = 1');
		record('snapshotBenchmark', 'lists-and-snapshots-a-committed-benchmark-tree',
			{ revision }, { files, snapshot });
	});
});

test('Runs Git commands in the selected workspace', async () => {
	await withTempRepo(async ({ root }) => {
		const stdout = await benchmarkGit(root, ['status', '--short']);
		expect(stdout).toBe('');
		record('benchmarkGit', 'runs-git-commands-in-the-selected-workspace',
			{ args: ['status', '--short'] }, { stdout });
	});
});

test('Creates a committed workspace and fingerprints regular files', async () => {
	await withTempDir('benchmark-workspace-', async (directory) => {
		const baseline = join(directory, 'baseline');
		const workspace = join(directory, 'workspace');
		await mkdir(baseline);
		await writeFile(join(baseline, 'sample.txt'), 'baseline');
		await createBenchmarkWorkspace(baseline, workspace);
		const regular = await regularBenchmarkFile(workspace, 'sample.txt');
		const value = await benchmarkFileValue(workspace, 'sample.txt');
		expect(regular).toBe(true);
		expect(value).toMatch(/^0:[a-f0-9]{64}$/);
		record('createBenchmarkWorkspace', 'creates-a-committed-workspace-and-fingerprints-regular-files',
			{ baseline: ['sample.txt'] }, { regular, value });
	});
});

test('Overlays regular files and removes missing source files', async () => {
	await withTempDir('benchmark-overlay-', async (directory) => {
		const source = join(directory, 'source');
		const target = join(directory, 'target');
		await mkdir(source);
		await mkdir(target);
		await writeFile(join(source, 'changed.txt'), 'new');
		await writeFile(join(target, 'changed.txt'), 'old');
		await writeFile(join(target, 'removed.txt'), 'stale');
		await symlink(join(source, 'changed.txt'), join(source, 'linked.txt'));
		await overlayBenchmarkFiles(source, target, ['changed.txt', 'removed.txt', 'linked.txt']);
		const changed = await readFile(join(target, 'changed.txt'), 'utf8');
		const removed = await regularBenchmarkFile(target, 'removed.txt');
		expect(changed).toBe('new');
		expect(removed).toBe(false);
		record('overlayBenchmarkFiles', 'overlays-regular-files-and-removes-missing-source-files',
			{ files: ['changed.txt', 'removed.txt', 'linked.txt'] }, { changed, removed });
	});
});
