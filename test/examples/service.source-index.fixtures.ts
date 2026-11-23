import type { ExecutionCase } from './service.source-index.test.types';
import ts from 'typescript';
import { ComponentPropsResolver } from '../../src/services/development-tooling/source-index-service/ComponentPropsResolver';
import { importedBinding } from '../../src/services/development-tooling/source-index-service/componentTypeBindings';
import type { SourceFile, SourceTree } from '../../src/core/development-tooling/sourceTypes';
import type { UnitsConfig } from '../../src/core/development-tooling/unitsConfig';

const UNIT = 'service.source-index';

export const GRID_PATH = 'src/lib/components/evidence/EvidenceGrid.svelte';

export const units: UnitsConfig = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/'],
	global: [],
	ignored: ['**/*.md'],
	references: []
};

export const EXECUTION_CASES: ExecutionCase[] = [
	[
		'interface-only TypeScript is declarative',
		'export interface EvidenceRow {\n\tid: string;\n}\n',
		'ts',
		'src/lib/reports/evidence.ts',
		'declarative'
	],
	[
		'a top-level const makes TypeScript runtime',
		'export const rowLimit = 50;\n',
		'ts',
		'src/lib/reports/limits.ts',
		'runtime'
	],
	[
		'TypeScript with parse diagnostics is unknown',
		'const = ;\n',
		'ts',
		'src/lib/reports/broken.ts',
		'unknown'
	],
	[
		'CSS is declarative without reading the code',
		'.row { color: red; }\n',
		'css',
		'src/styles/evidence.css',
		'declarative'
	],
	['Svelte is unknown', '<h1>Evidence</h1>\n', 'svelte', GRID_PATH, 'unknown']
];

export function meta(state: string, symbol: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

export function errorName(run: () => unknown): string {
	try {
		run();
		return 'none';
	} catch (error) {
		return error instanceof Error ? error.name : 'non-error';
	}
}

export function fakeTree(files: Record<string, string>, revision = 'rev-1'): SourceTree {
	return {
		revision,
		list: async () => Object.keys(files).map((path) => ({ path, hash: `hash:${path}` })),
		read: async (path: string) => {
			if (!(path in files)) throw new Error(`unreadable: ${path}`);
			return files[path];
		}
	};
}

export function propsOf(source: string, path: string) {
	const tree = fakeTree({ [path]: source });
	return new ComponentPropsResolver(tree, new Map<string, SourceFile>()).inputs(
		path,
		'EvidenceGrid'
	);
}

export function bindingFile() {
	return ts.createSourceFile(
		'bindings.ts',
		"import Grid from './EvidenceGrid.svelte';\nimport { EvidenceRow as Row } from '../reports/types';\nexport { Props } from './props';\n",
		ts.ScriptTarget.Latest,
		true
	);
}

export function bindingCase(file: ts.SourceFile, name: string) {
	return { name: `resolves ${name}`, input: { name }, output: importedBinding(file, name) ?? null };
}

export const literalKey = (name: string) =>
	ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(name));

export const PROPS = [
	{ name: 'rows', type: 'EvidenceRow[]', required: true },
	{ name: 'density', type: "'comfortable' | 'compact'", required: false }
];
