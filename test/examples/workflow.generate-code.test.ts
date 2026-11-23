import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	generateModel,
	renderGenerateResult
} from '../../src/workflows/generate-code/generateCode';
import { generationGroup } from '../../src/workflows/generate-code/generationGroup';
import { groupedFiles } from '../../src/workflows/projects-sessions/generate-code/groupedFiles';
import { groupedImports } from '../../src/workflows/generate-code/groupedImports';

const IMPORT_SOURCE = "import { two } from './two';\n";
const BEFORE = 'src/app/one.ts';
const AFTER = 'src/app/group/one.ts';
const MOVED = new Map([[BEFORE, AFTER]]);

function meta(state: string, symbol: string) {
	return {
		unitId: 'workflow.generate-code',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function errorDetails(error: unknown) {
	return {
		name: (error as Error).name,
		message: (error as Error).message
	};
}

test('Renders a generated model summary', () => {
	const result = { kind: 'model', name: 'user', writes: [], exportsUpdated: false };
	const text = renderGenerateResult(result);
	expect(text).toContain('user');
	recordExampleCases(meta('renders-a-generated-model-summary', 'renderGenerateResult'), [
		{ name: 'model user with no file writes', input: result, output: text }
	]);
});

test('Rejects an unsafe model name before writing', async () => {
	await withTempDir('generate-code-unsafe-name-', async (directory) => {
		const input = { name: '../escape', rawFields: [], adapter: 'sqlite' };
		let error: unknown;
		try {
			await generateModel({ ...input, root: directory });
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(meta('rejects-an-unsafe-model-name-before-writing', 'generateModel'), [
			{
				name: 'path-like model name is refused',
				input,
				error: errorDetails(error)
			}
		]);
	});
});

test('Selects an explicit category for a generation group', async () => {
	await withTempDir('generate-code-group-', async (directory) => {
		const selection = generationGroup(directory, { name: 'orders', group: 'core' });
		expect(selection?.group.id).toBe('core');
		recordExampleCases(
			meta('selects-an-explicit-category-for-a-generation-group', 'generationGroup'),
			[
				{
					name: 'explicit core group on an empty project',
					input: { name: 'orders', group: 'core' },
					output: { group: selection?.group.id ?? null, add: selection?.add ?? null }
				}
			]
		);
	});
});

test('Keeps planned paths when no category is given', () => {
	const files = [{ path: BEFORE, contents: IMPORT_SOURCE }];
	const grouped = groupedFiles(files);
	expect(grouped.paths.get(BEFORE)).toBe(BEFORE);
	expect(grouped.files[0].contents).toBe(IMPORT_SOURCE);
	recordExampleCases(meta('keeps-planned-paths-when-no-category-is-given', 'groupedFiles'), [
		{
			name: 'one file without a category',
			input: { files },
			output: {
				paths: Object.fromEntries(grouped.paths),
				contents: grouped.files[0].contents
			}
		}
	]);
});

test('Rewrites a module address that the generated file moved', () => {
	const output = groupedImports(IMPORT_SOURCE, BEFORE, AFTER, MOVED);
	expect(output).toContain("from '../two");
	recordExampleCases(
		meta('rewrites-a-module-address-that-the-generated-file-moved', 'groupedImports'),
		[
			{
				name: 'sibling import of an unmoved module from a moved file',
				input: { contents: IMPORT_SOURCE, before: BEFORE, after: AFTER },
				output
			}
		]
	);
});

test('Leaves ordinary strings untouched', () => {
	const contents = "const label = './two';\n";
	const output = groupedImports(contents, BEFORE, AFTER, MOVED);
	expect(output).toBe(contents);
	recordExampleCases(meta('leaves-ordinary-strings-untouched', 'groupedImports'), [
		{
			name: 'relative-looking string literal that is not a module address',
			input: { contents, before: BEFORE, after: AFTER },
			output
		}
	]);
});
