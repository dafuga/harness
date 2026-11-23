import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	createSourceReaderStore,
	implementationFiles,
	testFiles,
	archivedSource
} from '../../src/lib/explorer-ui/stores/sourceReader.svelte';
import type {
	SourceFiles,
	SourceRead
} from '../../src/lib/explorer-ui/stores/sourceReader.svelte.types';

const sourcePath = 'packages/reports/src/lib/explorer-ui/stores/sourceReader.svelte.ts';
const testPath = 'packages/reports/src/lib/explorer-ui/stores/sourceReader.svelte.test.ts';
const unit = (extra: Record<string, unknown> = {}) =>
	({ owns: { source: [sourcePath, testPath] }, ...extra }) as Parameters<
		typeof implementationFiles
	>[0];

test('Initializes and selects archived source', async () => {
	const store = createSourceReaderStore();
	const files: SourceFiles = async () => [sourcePath, testPath];
	const read: SourceRead = async (path) => `contents:${path}`;
	await store.initialise(files, read);
	expect(store.state).toMatchObject({
		files: [sourcePath, testPath],
		path: sourcePath,
		text: `contents:${sourcePath}`,
		loading: false,
		error: ''
	});
	await store.select(testPath);
	expect(store.state.text).toBe(`contents:${testPath}`);
	await store.select('missing.ts');
	const output = { ...store.state };
	expect(output.path).toBe(testPath);
	recordExampleCases(
		{
			unitId: 'reports.store.source-reader',
			symbol: 'createSourceReaderStore',
			state: 'initializes-and-selects-archived-source',
			evidence: 'examples-cases',
			file: 'initializes-and-selects-archived-source.json'
		},
		[
			{
				name: 'initial selection reads first path then accepts an indexed selection',
				input: {
					files: [sourcePath, testPath],
					selected: testPath,
					unknownSelection: 'missing.ts'
				},
				output
			}
		]
	);
});

test('Keeps archived paths ordered and unique', async () => {
	const value = unit({
		sourceFiles: [{ path: sourcePath }, { path: testPath }],
		testFiles: [{ path: testPath }, { path: 'packages/reports/test/example.test.ts' }],
		group: { id: 'stores', title: 'Stores' }
	});
	const implementation = implementationFiles(value);
	const tests = testFiles(value);
	const archive = archivedSource(value, 'https://reports.example.test/media/', testPath);
	const paths = await archive.files();
	expect(implementation).toEqual([sourcePath, testPath]);
	expect(tests).toEqual([testPath, 'packages/reports/test/example.test.ts']);
	expect(paths).toEqual([testPath, sourcePath, 'packages/reports/test/example.test.ts']);
	recordExampleCases(
		{
			unitId: 'reports.store.source-reader',
			symbol: 'archivedSource',
			state: 'keeps-archived-paths-ordered-and-unique',
			evidence: 'examples-cases',
			file: 'keeps-archived-paths-ordered-and-unique.json'
		},
		[
			{
				name: 'category paths and test snapshots are combined without duplicates',
				input: {
					sourceFiles: [sourcePath, testPath],
					testFiles: [testPath, 'packages/reports/test/example.test.ts'],
					group: 'stores',
					filePath: testPath
				},
				output: { implementation, tests, paths, empty: archive.empty ?? null }
			}
		]
	);
});

test('Reports unavailable archived source', async () => {
	const value = unit({ sourceFiles: [{ path: sourcePath, gap: 'Archive omitted this file.' }] });
	const archive = archivedSource(value, 'https://reports.example.test/media/');
	const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'unused' }) as Response);
	vi.stubGlobal('fetch', fetchMock);
	let message = '';
	try {
		await archive.read(sourcePath);
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	} finally {
		vi.unstubAllGlobals();
	}
	expect(message).toBe('Archive omitted this file.');
	expect(fetchMock).not.toHaveBeenCalled();
	recordExampleCases(
		{
			unitId: 'reports.store.source-reader',
			symbol: 'archivedSource',
			state: 'reports-unavailable-archived-source',
			evidence: 'examples-cases',
			file: 'reports-unavailable-archived-source.json'
		},
		[
			{
				name: 'an archive gap rejects before fetching media',
				input: { path: sourcePath, gap: 'Archive omitted this file.' },
				error: { name: 'ArchivedSourceReadError', message }
			}
		]
	);
});
