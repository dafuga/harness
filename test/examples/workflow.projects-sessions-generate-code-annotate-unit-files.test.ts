import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { annotateUnitFiles } from '../../src/workflows/projects-sessions/generate-code/annotateUnitFiles';

const UNIT_ID = 'workflow.projects-sessions-generate-code-annotate-unit-files';
const SOURCE_PATH = 'src/workflows/example/annotate.ts';
const SOURCE = 'export const value = 42;\n';
const UID_LINE = /^\/\/ @harness-uid u_\w+\n/;

function recordFor(state: string) {
	return {
		unitId: UNIT_ID,
		symbol: 'annotateUnitFiles',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function thrownBy(run: () => unknown): Error & { code?: string } {
	try {
		run();
	} catch (error) {
		return error as Error & { code?: string };
	}
	throw new Error('expected the call to throw');
}

test('Mints a uid for a new source file', async () => {
	await withTempDir('annotate-unit-files-new-', (root) => {
		const input = [{ path: SOURCE_PATH, contents: SOURCE }];
		const output = annotateUnitFiles(input, root);
		expect(output).toHaveLength(1);
		expect(output[0].path).toBe(SOURCE_PATH);
		expect(output[0].contents).toMatch(UID_LINE);
		expect(output[0].contents).toContain(SOURCE);
		recordExampleCases(recordFor('mints-a-uid-for-a-new-source-file'), [
			{
				name: 'new source file gets a minted uid line above its code',
				input,
				output: [{ path: output[0].path, contents: output[0].contents.replace(/u_\w+/, 'u_<uid>') }]
			}
		]);
	});
});

test('Reuses the uid already on disk', async () => {
	await withTempDir('annotate-unit-files-existing-', (root) => {
		mkdirSync(join(root, 'src/workflows/example'), { recursive: true });
		writeFileSync(
			join(root, SOURCE_PATH),
			'// @harness-uid u_abcdefgh23\nexport const value = 1;\n'
		);
		const input = [{ path: SOURCE_PATH, contents: SOURCE }];
		const output = annotateUnitFiles(input, root);
		expect(output[0].contents).toContain('// @harness-uid u_abcdefgh23');
		expect(output[0].contents).toContain(SOURCE);
		recordExampleCases(recordFor('reuses-the-uid-already-on-disk'), [
			{
				name: 'existing on-disk uid is kept when the file is generated again',
				input,
				output: [{ path: output[0].path, contents: output[0].contents }]
			}
		]);
	});
});

test('Throws Error when an existing target cannot be read', async () => {
	await withTempDir('annotate-unit-files-unreadable-', (root) => {
		mkdirSync(join(root, SOURCE_PATH), { recursive: true });
		const input = [{ path: SOURCE_PATH, contents: SOURCE }];
		const error = thrownBy(() => annotateUnitFiles(input, root));
		expect(error).toBeInstanceOf(Error);
		expect(error.code).toBe('EISDIR');
		recordExampleCases(recordFor('throws-error-when-an-existing-target-cannot-be-read'), [
			{
				name: 'a directory at the target path makes readFileSync fail',
				input,
				error: { name: error.name, code: error.code }
			}
		]);
	});
});

test('Returns test, type and adapter files unchanged', async () => {
	await withTempDir('annotate-unit-files-excluded-', (root) => {
		const input = [
			{ path: 'test/examples/example.test.ts', contents: 'export {};\n' },
			{ path: 'src/workflows/example/shapes.types.ts', contents: 'export type Shape = {};\n' },
			{ path: 'src/models/adapters/model.ts', contents: 'export const model = 1;\n' },
			{ path: 'db/schema.ts', contents: 'export const schema = {};\n' }
		];
		const output = annotateUnitFiles(input, root);
		expect(output).toEqual(input);
		recordExampleCases(recordFor('returns-test-type-and-adapter-files-unchanged'), [
			{
				name: 'test, type, adapter and db paths are returned exactly as given',
				input,
				output
			}
		]);
	});
});
