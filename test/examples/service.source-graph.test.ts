import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	fileNode,
	unitNode,
	scenarioNode,
	SourceGraphService
} from '../../src/services/development-tooling/SourceGraphService';

type Build = SourceGraphService['build'];
type Index = Parameters<Build>[0];
type Manifests = Parameters<Build>[1];
type Scenarios = NonNullable<Parameters<Build>[2]>;

const graphService = new SourceGraphService();

function sourceFile(path: string, classification: string, references: unknown[] = []) {
	return { path, classification, references };
}

function indexOf(files: Array<{ path: string }>): Index {
	const entries = files.map((file) => [file.path, file] as const);
	return { revision: 'rev-1', files: new Map(entries) } as unknown as Index;
}

function build(files: Array<{ path: string }>, units: unknown[], scenarioList: unknown[] = []) {
	return graphService.build(indexOf(files), units as Manifests, scenarioList as Scenarios);
}

const indexFiles = [
	sourceFile('src/a.ts', 'source', [{ via: 'import', typeOnly: false, path: 'src/b.ts' }]),
	sourceFile('src/b.ts', 'source'),
	sourceFile('test/a.test.ts', 'test')
];

const unitManifests = [
	{
		id: 'svc.a',
		status: 'active',
		owns: { source: ['src/a.ts'] },
		dependencies: [
			{ unit: 'svc.b', via: 'process' },
			{ unit: 'svc.c', via: 'import' }
		]
	},
	{ id: 'svc.b', status: 'active', owns: { source: ['src/b.ts'] }, dependencies: [] }
];

const scenarioManifests = [
	{ id: 'run-a', units: ['svc.a'], tests: [{ cwd: 'test', target: 'a.test.ts' }] }
];

test('Links files, owned units and scenarios into one graph', () => {
	const graph = build(indexFiles, unitManifests, scenarioManifests);
	const ids = graph.nodes.map((node) => node.id);

	expect(ids).toEqual([
		'file:src/a.ts',
		'file:src/b.ts',
		'file:test/a.test.ts',
		'scenario:run-a',
		'unit:svc.a',
		'unit:svc.b'
	]);
	expect(graph.nodes.find((node) => node.id === 'file:src/a.ts')).toEqual({
		id: 'file:src/a.ts',
		kind: 'source',
		unit: 'svc.a'
	});
	expect(graph.edges).toContainEqual({
		from: 'file:src/a.ts',
		to: 'file:src/b.ts',
		via: 'import',
		typeOnly: false
	});
	expect(graph.edges).toContainEqual({ from: 'unit:svc.a', to: 'unit:svc.b', via: 'process' });
	expect(graph.edges).toContainEqual({
		from: 'scenario:run-a',
		to: 'file:test/a.test.ts',
		via: 'proves'
	});
	expect(graph.edges.some((edge) => edge.to === 'unit:svc.c')).toBe(false);

	recordExampleCases(
		{
			unitId: 'service.source-graph',
			symbol: 'build',
			state: 'links-files-owned-units-and-scenarios-into-one-graph',
			evidence: 'examples-cases',
			file: 'links-files-owned-units-and-scenarios-into-one-graph.json'
		},
		[
			{
				name: 'files, active owned unit and scenario form sorted nodes and edges',
				input: { files: indexFiles, manifests: unitManifests, scenarios: scenarioManifests },
				output: { nodes: ids, edges: graph.edges }
			}
		]
	);
});

test('Keeps unresolved references as uncertainty', () => {
	const uncertainFiles = [
		sourceFile('src/c.ts', 'source', [
			{
				via: 'import',
				typeOnly: true,
				uncertain: { reason: 'dynamic-import', detail: 'computed specifier' }
			}
		])
	];
	const graph = build(uncertainFiles, []);

	expect(graph.uncertain).toEqual([
		{ node: 'file:src/c.ts', reason: 'dynamic-import', detail: 'computed specifier' }
	]);
	expect(graph.edges).toEqual([]);

	recordExampleCases(
		{
			unitId: 'service.source-graph',
			symbol: 'build',
			state: 'keeps-unresolved-references-as-uncertainty',
			evidence: 'examples-cases',
			file: 'keeps-unresolved-references-as-uncertainty.json'
		},
		[
			{
				name: 'reference without a resolved path is copied to uncertain and adds no edge',
				input: { files: uncertainFiles, manifests: [], scenarios: [] },
				output: { uncertain: graph.uncertain, edges: graph.edges }
			}
		]
	);
});

test('Prefixes node ids without changing the path', () => {
	const file = fileNode('src/x.ts');
	const unit = unitNode('svc.x');
	const scenario = scenarioNode('run-x');

	expect(file).toBe('file:src/x.ts');
	expect(unit).toBe('unit:svc.x');
	expect(scenario).toBe('scenario:run-x');

	recordExampleCases(
		{
			unitId: 'service.source-graph',
			symbol: 'fileNode',
			state: 'prefixes-node-ids-without-changing-the-path',
			evidence: 'examples-cases',
			file: 'prefixes-node-ids-without-changing-the-path.json'
		},
		[
			{ name: 'file path gets the file: prefix', input: 'src/x.ts', output: file },
			{ name: 'unit id gets the unit: prefix', input: 'svc.x', output: unit },
			{ name: 'scenario id gets the scenario: prefix', input: 'run-x', output: scenario }
		]
	);
});
