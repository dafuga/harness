import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'vitest';
import { SnapshotAdapter } from '../../src/adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const exampleEvidence = { unitId: 'adapter.snapshot', evidence: 'examples-cases' };

async function withSnapshot<T>(
	files: Record<string, string>,
	outputs: string[],
	use: (root: string, commit: string, snapshot: SnapshotAdapter) => Promise<T>,
	prepare?: (root: string) => void
): Promise<T> {
	return withTempRepo(async ({ root, git }) => {
		for (const [path, contents] of Object.entries(files)) {
			const target = join(root, path);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, contents);
		}
		git('add', '--all');
		git('commit', '-m', 'snapshot example');
		const commit = git('rev-parse', 'HEAD');
		prepare?.(root);
		const snapshot = await SnapshotAdapter.create(root, commit, outputs);
		try {
			return await use(root, commit, snapshot);
		} finally {
			await snapshot.remove();
		}
	}, 'snapshot-adapter-examples-');
}
test('Exports files from the requested commit', async () => {
	await withSnapshot(
		{ 'package.json': '{"version":"1"}', 'src/app.ts': 'export const version = 1;' },
		['dist/**'],
		async (root, commit, snapshot) => {
			const packageJson = await readFile(join(snapshot.directory, 'package.json'), 'utf8');
			const outsideCheckout = !resolve(snapshot.directory).startsWith(`${resolve(root)}/`);
			expect(packageJson).toBe('{"version":"1"}');
			expect(outsideCheckout).toBe(true);
			recordExampleCases(
				{
					...exampleEvidence,
					symbol: 'SnapshotAdapter.create',
					state: 'exports-files-from-the-requested-commit',
					file: 'exports-files-from-the-requested-commit.json'
				},
				[
					{
						name: 'the requested commit exports its tracked package outside the checkout',
						input: { root, commit, outputs: ['dist/**'] },
						output: { packageJson, outsideCheckout }
					}
				]
			);
		},
		(root) => writeFileSync(join(root, 'package.json'), '{"version":"2"}')
	);
});

test('Finds declared outputs that cover tracked files', async () => {
	await withSnapshot(
		{ 'dist/manifest.json': '{}', 'package.json': '{}' },
		['dist/**', 'coverage/**'],
		async (_root, _commit, snapshot) => {
			const output = snapshot.misdeclared();
			expect(output).toEqual([{ output: 'dist/**', file: 'dist/manifest.json' }]);
			recordExampleCases(
				{
					...exampleEvidence,
					symbol: 'SnapshotAdapter.misdeclared',
					state: 'finds-declared-outputs-that-cover-tracked-files',
					file: 'finds-declared-outputs-that-cover-tracked-files.json'
				},
				[
					{
						name: 'only the output pattern covering a tracked file is reported',
						input: { outputs: ['dist/**', 'coverage/**'] },
						output
					}
				]
			);
		}
	);
});

test('Creates shared links and rejects unavailable targets', async () => {
	await withSnapshot(
		{ '.gitignore': 'node_modules/\nvendor/\n', 'package.json': '{}' },
		[],
		async (root, _commit, snapshot) => {
			const paths = ['node_modules', 'missing-cache', 'package.json', 'vendor/cache'];
			const results: boolean[] = [];
			for (const path of paths) results.push(await snapshot.link(root, path));
			expect(results).toEqual([true, false, false, false]);
			recordExampleCases(
				{
					...exampleEvidence,
					symbol: 'SnapshotAdapter.link',
					state: 'creates-shared-links-and-rejects-unavailable-targets',
					file: 'creates-shared-links-and-rejects-unavailable-targets.json'
				},
				paths.map((path, index) => ({
					name: `link ${path} from the temporary checkout`,
					input: { root, path },
					output: results[index]
				}))
			);
		},
		(root) => {
			mkdirSync(join(root, 'node_modules'));
			writeFileSync(join(root, 'node_modules', 'fixture.txt'), 'shared dependency');
			mkdirSync(join(root, 'vendor', 'cache'), { recursive: true });
		}
	);
});

test('Reports tracked drift and uncovered additions', async () => {
	await withSnapshot(
		{
			'.gitignore': 'node_modules/\n',
			'dist/manifest.json': '{}',
			'src/app.ts': 'export const value = 1;',
			'src/removed.ts': 'export const removed = true;'
		},
		['dist/**'],
		async (root, _commit, snapshot) => {
			await snapshot.link(root, 'node_modules');
			writeFileSync(join(snapshot.directory, 'src/app.ts'), 'export const value = 2;');
			unlinkSync(join(snapshot.directory, 'src/removed.ts'));
			writeFileSync(join(snapshot.directory, 'dist/generated.js'), 'built');
			mkdirSync(join(snapshot.directory, 'tmp'));
			writeFileSync(join(snapshot.directory, 'tmp/check.log'), 'check output');
			unlinkSync(join(snapshot.directory, 'node_modules'));
			writeFileSync(join(snapshot.directory, 'node_modules'), 'replacement');
			const output = await snapshot.drift();
			expect(output).toEqual({
				mutated: ['src/app.ts', 'src/removed.ts', 'node_modules'],
				added: ['tmp/check.log']
			});
			recordExampleCases(
				{
					...exampleEvidence,
					symbol: 'SnapshotAdapter.drift',
					state: 'reports-tracked-drift-and-uncovered-additions',
					file: 'reports-tracked-drift-and-uncovered-additions.json'
				},
				[
					{
						name: 'tracked changes and replaced links are mutations while declared output is covered',
						input: {
							changed: 'src/app.ts',
							deleted: 'src/removed.ts',
							replacedLink: 'node_modules',
							added: ['dist/generated.js', 'tmp/check.log'],
							outputs: ['dist/**']
						},
						output
					}
				]
			);
		},
		(root) => mkdirSync(join(root, 'node_modules'))
	);
});

test('Hashes readable artifacts and omits unavailable paths', async () => {
	await withSnapshot({ 'package.json': '{}' }, [], async (_root, _commit, snapshot) => {
		const paths = ['package.json', '../outside.json', 'missing.json'];
		const results = await Promise.all(paths.map((path) => snapshot.artifact(path)));
		expect(results[0]).toEqual({
			bytes: 2,
			sha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
		});
		expect(results[1]).toBeUndefined();
		expect(results[2]).toBeUndefined();
		recordExampleCases(
			{
				...exampleEvidence,
				symbol: 'SnapshotAdapter.artifact',
				state: 'hashes-readable-artifacts-and-omits-unavailable-paths',
				file: 'hashes-readable-artifacts-and-omits-unavailable-paths.json'
			},
			paths.map((path, index) => ({
				name: `read artifact path ${path}`,
				input: { path },
				output: results[index] ?? null
			}))
		);
	});
});

test('Removes the exported snapshot directory', async () => {
	await withSnapshot({ 'package.json': '{}' }, [], async (_root, _commit, snapshot) => {
		const directory = snapshot.directory;
		await snapshot.remove();
		const output = { returned: null, directoryExists: existsSync(directory) };
		expect(output.directoryExists).toBe(false);
		recordExampleCases(
			{
				...exampleEvidence,
				symbol: 'SnapshotAdapter.remove',
				state: 'removes-the-exported-snapshot-directory',
				file: 'removes-the-exported-snapshot-directory.json'
			},
			[
				{
					name: 'remove resolves and the snapshot directory is gone',
					input: { directory },
					output
				}
			]
		);
	});
});
