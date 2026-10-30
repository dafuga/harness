import { expect } from 'vitest';
import type { UnitDetail } from '../../src/cli/program/inspectUnits.types';
import { testAttribution } from '../../src/cli/program/testAttribution';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { renderUnit } from '../../src/cli/program/renderUnit';
import { measureWorkload } from '../support/measureWorkload';

export async function assertTestAttribution(unit: UnitDetail): Promise<void> {
	await measureWorkload(
		'workflow.inspect-units',
		'attribute-direct-transitive-and-authored-tests',
		() => {
			const graph = testGraph();
			const scenario = scenarioManifestSchema.parse({
				schemaVersion: 1,
				id: 'badge',
				title: 'Badge',
				kind: 'headless',
				units: [unit.manifest.id],
				states: [{ id: 'shown', title: 'Shown', coverage: 'required' }],
				viewports: [],
				tests: [{ id: 'badge', kind: 'unit', runner: 'vitest', target: 'test/badge.test.ts' }],
				evidence: []
			});
			const attribution = testAttribution(graph, unit.manifest, [scenario]);
			expect(attribution.directImports.map((test) => test.dependency)).toEqual([
				'runtime',
				'type-only',
				'unknown'
			]);
			expect(attribution.transitiveImpacts).toEqual([
				{
					file: 'test/transitive.test.ts',
					path: [graph.edges[2], graph.edges[3]],
					dependency: 'runtime'
				}
			]);
			expect(attribution.scenarios).toEqual([{ id: 'badge', tests: scenario.tests, evidence: [] }]);
			unit.testAttribution = attribution;
			expect(renderUnit(unit)).toContain('Impacted test files');
			expect(renderUnit(unit)).toContain('Direct import files');
			expect(renderUnit(unit)).toContain('Authored scenarios');
		}
	);
}

function testGraph() {
	const source = 'file:src/Badge.svelte';
	const edge = (from: string, to = source, typeOnly?: boolean) => ({
		from,
		to,
		via: 'import',
		...(typeOnly === undefined ? {} : { typeOnly })
	});
	return {
		nodes: ['direct', 'type', 'transitive', 'unknown'].map((name) => ({
			id: `file:test/${name}.test.ts`,
			kind: 'test' as const
		})),
		edges: [
			edge('file:test/direct.test.ts', source, false),
			edge('file:test/type.test.ts', source, true),
			edge('file:test/transitive.test.ts', 'file:forward.ts', false),
			{ ...edge('file:forward.ts', source, false), via: 'reexport' },
			edge('file:test/unknown.test.ts')
		],
		uncertain: []
	};
}
