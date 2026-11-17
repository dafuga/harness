import { test } from 'vitest';
import type {
	ExportedSymbol,
	GraphEdge,
	GraphNode,
	ResolvedReference,
	SourceFile,
	SourceGraph,
	UncertainNode
} from '../../src/core/development-tooling/sourceTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const configExport = {
	name: 'parseConfig',
	kind: 'function',
	inputs: []
} satisfies ExportedSymbol;

const configImport = {
	via: 'import',
	typeOnly: true,
	path: 'src/core/config.ts'
} satisfies ResolvedReference;

const configFile = {
	path: 'src/core/config/parse.ts',
	hash: 'fixture-blob-7f3a',
	bytes: 412,
	lines: 18,
	language: 'ts',
	classification: 'source',
	workspace: 'core',
	read: true,
	decisions: 'counted',
	references: [configImport],
	blocks: [],
	exports: [configExport],
	errors: []
} satisfies SourceFile;

const parseNode = {
	id: 'src/core/config/parse.ts',
	kind: 'source'
} satisfies GraphNode;

const configNode = {
	id: 'src/core/config.ts',
	kind: 'source'
} satisfies GraphNode;

const configEdge = {
	from: 'src/core/config/parse.ts',
	to: 'src/core/config.ts',
	via: 'import',
	typeOnly: true
} satisfies GraphEdge;

const unresolvedNode = {
	node: 'src/core/config/parse.ts',
	reason: 'unresolved-import',
	detail: "'./missing' has no tracked file"
} satisfies UncertainNode;

const configGraph = {
	nodes: [parseNode, configNode],
	edges: [configEdge],
	uncertain: [unresolvedNode]
} satisfies SourceGraph;

test('Source file facts describe a classified TypeScript file', () => {
	expect(configFile.classification).toBe('source');
	expect(configFile.exports).toEqual([
		{ name: 'parseConfig', kind: 'function', inputs: [] }
	]);
	expect(configFile.references[0]).toEqual({
		via: 'import',
		typeOnly: true,
		path: 'src/core/config.ts'
	});
	recordExampleCases(
		{
			unitId: 'function.source-types',
			symbol: 'SourceFile',
			state: 'source-file-facts-describe-a-classified-typescript-file',
			evidence: 'examples-cases',
			file: 'source-file-facts-describe-a-classified-typescript-file.json'
		},
		[
			{
				name: 'parsed TypeScript source file with one export',
				input: { path: configFile.path, language: 'ts', bytes: 412 },
				output: {
					classification: 'source',
					read: true,
					exports: ['parseConfig'],
					references: ['src/core/config.ts']
				}
			}
		]
	);
});

test('Source graph keeps unresolved imports as uncertain nodes', () => {
	expect(configGraph.edges).toHaveLength(1);
	expect(configGraph.edges[0]).toEqual({
		from: 'src/core/config/parse.ts',
		to: 'src/core/config.ts',
		via: 'import',
		typeOnly: true
	});
	expect(configGraph.uncertain).toEqual([
		{
			node: 'src/core/config/parse.ts',
			reason: 'unresolved-import',
			detail: "'./missing' has no tracked file"
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.source-types',
			symbol: 'SourceGraph',
			state: 'source-graph-keeps-unresolved-imports-as-uncertain-nodes',
			evidence: 'examples-cases',
			file: 'source-graph-keeps-unresolved-imports-as-uncertain-nodes.json'
		},
		[
			{
				name: 'source file with a resolved import and an unresolved import',
				input: { nodes: ['src/core/config/parse.ts', 'src/core/config.ts'] },
				output: {
					edgeCount: 1,
					edges: ['src/core/config/parse.ts -> src/core/config.ts (import)'],
					uncertainReasons: ['unresolved-import']
				}
			}
		]
	);
});
