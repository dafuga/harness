import { expect } from 'vitest';
import sourceGraph from '../../../specification/units/service.source-graph.json';
import { HandlerRuntimeAdapter } from '../../../src/adapters/HandlerRuntimeAdapter';
import type { SourceIndex } from '../../../src/services/source-index-service/SourceIndexService';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../../src/core/unitsConfig';
import type { SourceGraphService } from '../../../src/services/SourceGraphService';
import { ImpactService } from '../../../src/services/impact-service/ImpactService';
import { impactKernel } from '../../../src/utils/impact-kernel/impactKernel';
import { TestCaseValidator } from '../../../src/validators/verification-evidence/TestCaseValidator';
import { indexFiles, retire, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';

export async function assertContractGraph(builder: SourceGraphService): Promise<void> {
	expect(builder.build({ revision: 'empty', files: new Map() }, [])).toEqual(
		sourceGraph.testing.cases[0].expected.value
	);
	await assertDeclaredDependency(builder);
	await assertRegisteredCaseImpact(builder);
}

async function assertDeclaredDependency(builder: SourceGraphService): Promise<void> {
	const files = {
		'src/utils/rank.ts': 'export function rank(value: number): number {\n\treturn value;\n}\n',
		'src/utils/rankFast.ts':
			'export function rankFast(value: number): number {\n\treturn value;\n}\n'
	};
	const first = await indexFiles(files);
	const link = {
		unit: 'function.rank',
		via: 'contract',
		origin: 'declared',
		contract: 'rank'
	} as const;
	const fast = { ...unitOf(first, 'function.rank-fast'), dependencies: [link] };
	const again = await indexFiles(files, [unitOf(first, 'function.rank'), fast]);
	expect(again.result.updated).toEqual([]);
	expect(unitOf(again, 'function.rank-fast').dependencies).toEqual([link]);
	const graph = builder.build(again.index, again.result.manifests);
	expect(graph.edges).toEqual(
		expect.arrayContaining([
			{ from: 'unit:function.rank-fast', to: 'unit:function.rank', via: 'contract' },
			{ from: 'file:src/utils/rankFast.ts', to: 'unit:function.rank', via: 'contract' }
		])
	);
}

async function assertRegisteredCaseImpact(builder: SourceGraphService): Promise<void> {
	const indexed = await indexFiles({
		'src/utils/rank.ts': 'export function rank(value: number) { return value; }',
		'test/rank.example.test.ts': "import { test } from 'vitest'; test('rank: identity', () => {});",
		'test/rank.consumer.test.ts':
			"import { rank } from '../src/utils/rank'; export const subject = rank;"
	});
	const unit = unitOf(indexed, 'function.rank');
	const registered = registeredRank(unit);
	const manifests = indexed.result.manifests.map((item) =>
		item.id === unit.id ? registered : item
	);
	const graph = await measureWorkload('service.source-graph', 'registered-case-graph', () =>
		builder.build(indexed.index, manifests)
	);
	const edge = { from: 'file:test/rank.example.test.ts', to: 'unit:function.rank', via: 'covers' };
	expect(graph.edges, 'registered cases connect their test files to the subject').toContainEqual(
		edge
	);
	assertAdmittedCaseArrays(builder, indexed.index, unit, edge);
	expect(builder.build(indexed.index, [retire(registered)]).edges).not.toContainEqual(edge);
	const head = {
		revision: 'head',
		config: defaultUnitsConfig,
		entries: [...indexed.index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests,
		scenarios: [],
		graph
	};
	const base = {
		...head,
		revision: 'base',
		entries: head.entries.map((entry) =>
			entry.path === 'src/utils/rank.ts' ? { ...entry, hash: '0'.repeat(40) } : entry
		)
	};
	const report = await new ImpactService(new HandlerRuntimeAdapter(impactKernel)).compute(
		base,
		head
	);
	expect(report.expanded).toBe(false);
	expect(report.tests.selected).toEqual([
		'test/rank.consumer.test.ts',
		'test/rank.example.test.ts'
	]);
}

function assertAdmittedCaseArrays(
	builder: SourceGraphService,
	index: SourceIndex,
	unit: ComponentManifest,
	edge: { from: string; to: string; via: string }
): void {
	for (const mode of ['iterator', 'species', 'getter'] as const) {
		const registered = registeredRank(unit);
		const cases = registered.testing!.cases;
		let reads = 0;
		if (mode === 'iterator')
			Object.defineProperty(cases, Symbol.iterator, { value: function* () {} });
		if (mode === 'species')
			Object.defineProperty(cases, 'constructor', {
				value: {
					[Symbol.species]: () => {
						throw new Error('species invoked');
					}
				}
			});
		if (mode === 'getter')
			Object.defineProperty(cases[0].test, 'file', {
				enumerable: true,
				get: () => {
					reads += 1;
					return 'test/rank.example.test.ts';
				}
			});
		expect(new TestCaseValidator().validate(registered, registered.testing).valid, mode).toBe(true);
		reads = 0;
		expect(builder.build(index, [registered]).edges, mode).toContainEqual(edge);
		if (mode === 'getter') expect(reads).toBe(1);
	}
}

function registeredRank(unit: ComponentManifest): ComponentManifest {
	return {
		...unit,
		testing: {
			version: 1 as const,
			shape: 'helper' as const,
			states: ['default'],
			examples: [
				{
					subject: 'rank',
					name: 'identity',
					call: 'rank(1)',
					input: [1],
					expected: { kind: 'value' as const, value: 1 }
				}
			],
			cases: [
				{
					id: 'identity',
					state: 'default',
					subject: 'rank',
					example: 'identity',
					test: { file: 'test/rank.example.test.ts', title: 'rank: identity' }
				}
			]
		}
	};
}
