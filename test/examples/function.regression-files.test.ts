import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { metadata, regressionFiles, testPath } from '../../src/utils/verification-evidence/regressionFiles';
import { regressionTestCommit } from '../../src/workflows/verification-evidence/record-regression/regressionFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Recognizes regression test paths', () => {
	const cases = [
		{ name: 'tests directory', input: 'tests/utils/regressionFiles.test.ts', output: true },
		{ name: 'scenario file', input: 'specification/scenarios/regression-files.json', output: true },
		{ name: 'product source', input: 'src/utils/verification-evidence/regressionFiles.ts', output: false }
	];
	const outputs = cases.map(({ input }) => testPath(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	recordExampleCases(
		{ unitId: 'function.regression-files', symbol: 'testPath', state: 'recognizes-regression-test-paths', evidence: 'examples-cases', file: 'recognizes-regression-test-paths.json' },
		cases.map(({ name, input }, index) => ({ name, input, output: outputs[index] }))
	);
});

test('Recognizes regression metadata paths', () => {
	const cases = [
		{ name: 'loop definition', input: 'specification/loops/regression-files.yaml', output: true },
		{ name: 'markdown documentation', input: 'docs/regression-files.md', output: true },
		{ name: 'product source', input: 'src/utils/verification-evidence/regressionFiles.ts', output: false }
	];
	const outputs = cases.map(({ input }) => metadata(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	recordExampleCases(
		{ unitId: 'function.regression-files', symbol: 'metadata', state: 'recognizes-regression-metadata-paths', evidence: 'examples-cases', file: 'recognizes-regression-metadata-paths.json' },
		cases.map(({ name, input }, index) => ({ name, input, output: outputs[index] }))
	);
});

test('Freezes tracked tests and runner configuration', async () => {
	await withTempRepo(async ({ root, git }) => {
		await mkdir(join(root, 'tests'), { recursive: true });
		await writeFile(join(root, 'tests/regression.test.ts'), 'test fixture');
		await writeFile(join(root, 'package.json'), '{}');
		await writeFile(join(root, 'notes.txt'), 'excluded');
		git('add', '.');
		git('commit', '-m', 'fixture');
		const commit = git('rev-parse', 'HEAD');
		const output = await regressionFiles(root, commit, ['tests/regression.test.ts']);
		expect(output.map(({ path }) => path)).toEqual(['package.json', 'tests/regression.test.ts']);
		recordExampleCases(
			{ unitId: 'function.regression-files', symbol: 'regressionFiles', state: 'freezes-tracked-tests-and-runner-configuration', evidence: 'examples-cases', file: 'freezes-tracked-tests-and-runner-configuration.json' },
			[{ name: 'selected commit includes test and runner config', input: { commit, tests: ['tests/regression.test.ts'] }, output: output.map(({ path, hash }) => ({ path, hash })) }]
		);
	});
});

test('Accepts a test-only failing checkpoint', async () => {
	await withTempRepo(async ({ root, git }) => {
		await writeFile(join(root, 'README.md'), 'baseline');
		git('add', '.');
		git('commit', '-m', 'baseline');
		await mkdir(join(root, 'tests'), { recursive: true });
		await writeFile(join(root, 'tests/regression.test.ts'), 'strengthened test');
		git('add', '.');
		git('commit', '-m', 'add strengthened test');
		const commit = git('rev-parse', 'HEAD');
		await expect(regressionTestCommit(root, commit, ['tests/regression.test.ts'])).resolves.toBeUndefined();
		recordExampleCases(
			{ unitId: 'function.regression-files', symbol: 'regressionTestCommit', state: 'accepts-a-test-only-failing-checkpoint', evidence: 'examples-cases', file: 'accepts-a-test-only-failing-checkpoint.json' },
			[{ name: 'checkpoint changes a named regression test', input: { commit, tests: ['tests/regression.test.ts'] }, output: null }]
		);
	});
});
