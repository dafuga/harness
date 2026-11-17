import ts from 'typescript';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ComponentPropsResolver } from '../../src/services/development-tooling/source-index-service/ComponentPropsResolver';
import { SourceIndexService } from '../../src/services/development-tooling/source-index-service/SourceIndexService';
import {
	importedBinding,
	selectedProps
} from '../../src/services/development-tooling/source-index-service/componentTypeBindings';
import { scanStorage } from '../../src/services/development-tooling/source-index-service/scanStorage';
import { sourceExecution } from '../../src/services/development-tooling/source-index-service/sourceExecution';
import type { SourceFile, SourceTree } from '../../src/core/development-tooling/sourceTypes';
import type { UnitsConfig } from '../../src/core/development-tooling/unitsConfig';
import type { SourceLanguage } from '../../src/utils/development-tooling/scanImports.types';

const UNIT = 'service.source-index';
const GRID_PATH = 'src/lib/components/evidence/EvidenceGrid.svelte';

const GRID = `<script lang="ts">
	let { rows, density = 'compact', onSelect }: { rows: EvidenceRow[]; density?: 'comfortable' | 'compact'; onSelect?: (row: EvidenceRow) => void } = $props();
</script>
`;

const REPORT = `export class Report {
	static definition = {
		table: 'reports',
		fields: {
			id: { type: 'string' },
			title: { type: 'string', required: true }
		}
	};
}
`;

const units: UnitsConfig = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/'],
	global: [],
	ignored: ['**/*.md'],
	references: []
};

type ExecutionCase = [name: string, code: string, language: SourceLanguage, path: string, expected: string];

const EXECUTION_CASES: ExecutionCase[] = [
	['interface-only TypeScript is declarative', 'export interface EvidenceRow {\n\tid: string;\n}\n', 'ts', 'src/lib/reports/evidence.ts', 'declarative'],
	['a top-level const makes TypeScript runtime', 'export const rowLimit = 50;\n', 'ts', 'src/lib/reports/limits.ts', 'runtime'],
	['TypeScript with parse diagnostics is unknown', 'const = ;\n', 'ts', 'src/lib/reports/broken.ts', 'unknown'],
	['CSS is declarative without reading the code', '.row { color: red; }\n', 'css', 'src/styles/evidence.css', 'declarative'],
	['Svelte is unknown', '<h1>Evidence</h1>\n', 'svelte', GRID_PATH, 'unknown']
];

function meta(state: string, symbol: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function errorName(run: () => unknown): string { try { run(); return 'none'; } catch (error) { return error instanceof Error ? error.name : 'non-error'; } }

function fakeTree(files: Record<string, string>, revision = 'rev-1'): SourceTree {
	return {
		revision,
		list: async () => Object.keys(files).map((path) => ({ path, hash: `hash:${path}` })),
		read: async (path: string) => {
			if (!(path in files)) throw new Error(`unreadable: ${path}`);
			return files[path];
		}
	};
}

function propsOf(source: string, path: string) {
	const tree = fakeTree({ [path]: source });
	return new ComponentPropsResolver(tree, new Map<string, SourceFile>()).inputs(path, 'EvidenceGrid');
}

function bindingFile() {
	return ts.createSourceFile(
		'bindings.ts',
		"import Grid from './EvidenceGrid.svelte';\nimport { EvidenceRow as Row } from '../reports/types';\nexport { Props } from './props';\n",
		ts.ScriptTarget.Latest,
		true
	);
}

function bindingCase(file: ts.SourceFile, name: string) {
	return { name: `resolves ${name}`, input: { name }, output: importedBinding(file, name) ?? null };
}

const literalKey = (name: string) =>
	ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(name));

const PROPS = [
	{ name: 'rows', type: 'EvidenceRow[]', required: true },
	{ name: 'density', type: "'comfortable' | 'compact'", required: false }
];

test('Resolves owner-prefixed props from a $props destructuring', async () => {
	const inputs = await propsOf(GRID, GRID_PATH);
	const empty = await propsOf('export const rowLimit = 50;\n', 'src/lib/reports/limit.ts');
	expect(inputs.map((item) => item.name)).toEqual([
		'EvidenceGrid.rows',
		'EvidenceGrid.density',
		'EvidenceGrid.onSelect'
	]);
	expect(inputs[0].required).toBe(true);
	expect(empty).toEqual([]);
	recordExampleCases(meta('resolves-owner-prefixed-props-from-a-props-destructuring', 'inputs'), [
		{
			name: 'svelte $props destructuring yields owner-prefixed fields',
			input: { path: GRID_PATH, owner: 'EvidenceGrid' },
			output: inputs
		},
		{
			name: 'file without a $props call yields no fields',
			input: { path: 'src/lib/reports/limit.ts', owner: 'EvidenceGrid' },
			output: empty
		}
	]);
});

test('Indexes readable files and omits ignored ones', async () => {
	const files = {
		'src/lib/reports/evidence.ts': 'export interface EvidenceRow {\n\tid: string;\n}\n',
		[GRID_PATH]: GRID,
		'docs/readme.md': '# Notes\n'
	};
	const index = await new SourceIndexService().index(fakeTree(files, 'rev-7'), units);
	const paths = [...index.files.keys()].sort();
	expect(index.revision).toBe('rev-7');
	expect(paths).toEqual([GRID_PATH, 'src/lib/reports/evidence.ts']);
	expect(index.files.has('docs/readme.md')).toBe(false);
	const broken: SourceTree = { revision: 'rev-bad', list: async () => [{ path: 'src/lib/broken.ts', hash: 'h' }], read: async () => { throw new Error('read failed'); } };
	await expect(new SourceIndexService().index(broken, units)).rejects.toThrow('read failed');
	recordExampleCases(meta('indexes-readable-files-and-omits-ignored-ones', 'index'), [
		{ name: 'a rejected read rejects index with no partial index', input: { revision: 'rev-bad', path: 'src/lib/broken.ts' }, error: 'read failed' },
		{
			name: 'readable non-ignored files are indexed at the snapshot revision',
			input: { revision: 'rev-7', entries: Object.keys(files) },
			output: { revision: index.revision, paths }
		},
		{
			name: 'markdown matched by the ignored pattern is absent',
			input: { path: 'docs/readme.md' },
			output: { indexed: index.files.has('docs/readme.md') }
		}
	]);
});

test('Resolves import bindings and selects props', () => {
	const file = bindingFile();
	expect(importedBinding(file, 'Grid')).toEqual({ name: 'default', specifier: './EvidenceGrid.svelte' });
	expect(importedBinding(file, 'Row')).toEqual({ name: 'EvidenceRow', specifier: '../reports/types' });
	expect(importedBinding(file, 'Props')).toEqual({ name: 'Props', specifier: './props' });
	expect(importedBinding(file, 'Missing')).toBeUndefined();
	const pick = selectedProps(PROPS, 'Pick', literalKey('rows'));
	const omit = selectedProps(PROPS, 'Omit', literalKey('rows'));
	const required = selectedProps(PROPS, 'Required', undefined);
	expect(pick.map((item) => item.name)).toEqual(['rows']);
	expect(omit.map((item) => item.name)).toEqual(['density']);
	expect(required.every((item) => item.required)).toBe(true);
	expect(PROPS[1].required).toBe(false);
	recordExampleCases(meta('resolves-import-bindings-and-selects-props', 'importedBinding'), [
		bindingCase(file, 'Grid'),
		bindingCase(file, 'Row'),
		bindingCase(file, 'Props'),
		bindingCase(file, 'Missing'),
		{ name: 'Pick keeps the named prop', input: { operator: 'Pick', keys: ['rows'] }, output: pick },
		{ name: 'Omit drops the named prop', input: { operator: 'Omit', keys: ['rows'] }, output: omit },
		{ name: 'Required marks every prop required', input: { operator: 'Required' }, output: required }
	]);
});

test('Reads storage records and classifies execution', () => {
	const [record] = scanStorage(REPORT);
	expect(record.name).toBe('Report');
	expect(record.table).toBe('reports');
	expect(record.primaryKey).toBe('id');
	expect(record.fields.map((field) => field.name)).toEqual(['id', 'title']);
	const none = scanStorage('export class Empty {}\n');
	expect(none).toEqual([]);
	const executions = EXECUTION_CASES.map(([name, code, language, path, expected]) => {
		const output = sourceExecution(code, language, path);
		expect(output).toBe(expected);
		return { name: `sourceExecution: ${name}`, input: { code, language, path }, output };
	});
	recordExampleCases(meta('reads-storage-records-and-classifies-execution', 'scanStorage'), [
		{
			name: 'exported class with a static definition yields a storage record',
			input: { code: REPORT },
			output: {
				name: record.name,
				table: record.table,
				primaryKey: record.primaryKey,
				fields: record.fields.map((field) => field.name)
			}
		},
		{
			name: 'exported class without a static definition yields no records',
			input: { code: 'export class Empty {}\n' },
			output: none
		},
		...executions
	]);
});

test('Throws Source read or parse failure when read rejects', async () => {
	await expect(new ComponentPropsResolver(fakeTree({}), new Map<string, SourceFile>()).inputs(GRID_PATH, 'EvidenceGrid')).rejects.toThrow('unreadable');
	recordExampleCases(meta('throws-source-read-or-parse-failure-when-read-rejects', 'inputs'), [{ name: 'a rejected snapshot read rejects the call', input: { path: GRID_PATH, owner: 'EvidenceGrid' }, error: `unreadable: ${GRID_PATH}` }]);
});

test('Throws Source syntax access failure when text is undefined', () => {
	const name = errorName(() => sourceExecution(undefined as unknown as string, 'ts', 'src/lib/x.ts'));
	expect(name).not.toBe('none');
	recordExampleCases(meta('throws-source-syntax-access-failure-when-text-is-undefined', 'sourceExecution'), [{ name: 'undefined source text throws from the parser', input: { code: 'undefined', language: 'ts', path: 'src/lib/x.ts' }, error: name }]);
});
