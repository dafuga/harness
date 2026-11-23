import type { Changes, Manifest } from './function.impact-seeds.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { impactSeeds } from '../../src/services/reports-media/impact-service/impactSeeds';
import type { Sides } from '../../src/services/reports-media/impact-service/impactSeeds.types';
import type { ImpactSeeds } from '../../src/utils/reports-media/impactSeeds';

const UNIT = 'function.impact-seeds';
const OWNED = 'src/services/reports-media/impact-service/impactSeeds.ts';
const LEGACY = 'src/utils/impactSeeds.ts';
const UNIT_FILE = 'specification/units/function.impact-seeds.json';

const CONFIG: Sides['base']['config'] = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/', 'tests/'],
	global: ['package.json'],
	ignored: ['**/*.md', 'specification/features/', 'specification/loops/', '.gitignore'],
	references: []
};

const MIXED: Changes = [
	{ path: OWNED, status: 'modified' },
	{ path: 'README.md', status: 'modified' },
	{ path: 'package.json', status: 'modified' },
	{ path: 'notes/plan.txt', status: 'added' }
];
const IGNORED: Changes = [{ path: 'README.md', status: 'modified' }];
const MANIFEST_CHANGE: Changes = [
	{ path: UNIT_FILE, status: 'modified' },
	{ path: LEGACY, status: 'removed' }
];

function side(manifests: Manifest[]): Sides['base'] {
	return {
		revision: 'fixture',
		config: CONFIG,
		entries: [],
		manifests,
		scenarios: [],
		graph: { nodes: [], edges: [], uncertain: [] }
	} as unknown as Sides['base'];
}

function sidesFor(headSource: string[], baseSource: string[]): Sides {
	const unit = (source: string[]): Manifest => ({ id: UNIT, status: 'active', owns: { source } });
	return { base: side([unit(baseSource)]), head: side([unit(headSource)]) };
}

function summarise(result: ImpactSeeds) {
	return {
		changed: result.changed.map(({ path, status, classification, unit }) => ({
			path,
			status,
			classification,
			unit: unit ?? null
		})),
		seeds: result.seeds,
		direct: [...result.direct],
		expansions: result.expansions
	};
}

test('Classifies changed paths into seeds and expansions', () => {
	const sides = sidesFor([OWNED], [LEGACY]);
	const mixed = impactSeeds(MIXED, sides);
	const ignoredOnly = impactSeeds(IGNORED, sides);

	expect(mixed.seeds).toEqual([`file:${OWNED}`, 'file:package.json', 'file:notes/plan.txt']);
	expect([...mixed.direct]).toEqual([UNIT]);
	expect(mixed.expansions).toEqual([
		{ node: 'file:package.json', reason: 'global-change', detail: 'package.json' },
		{ node: 'file:notes/plan.txt', reason: 'unclassified-change', detail: 'notes/plan.txt' }
	]);
	expect(ignoredOnly.seeds).toEqual([]);
	expect(ignoredOnly.expansions).toEqual([]);
	expect(ignoredOnly.changed).toMatchObject([{ path: 'README.md', classification: 'ignored' }]);

	recordExampleCases(
		{
			unitId: 'function.impact-seeds',
			symbol: 'impactSeeds',
			state: 'classifies-changed-paths-into-seeds-and-expansions',
			evidence: 'examples-cases',
			file: 'classifies-changed-paths-into-seeds-and-expansions.json'
		},
		[
			{
				name: 'source, global, unclassified and ignored changes',
				input: { changes: MIXED, sides },
				output: summarise(mixed)
			},
			{
				name: 'ignored markdown adds no seeds or expansions',
				input: { changes: IGNORED, sides },
				output: summarise(ignoredOnly)
			}
		]
	);
});

test('Changed unit manifest seeds its unit and owned files', () => {
	const sides = sidesFor([LEGACY], [LEGACY]);
	const result = impactSeeds(MANIFEST_CHANGE, sides);

	expect(result.seeds).toEqual([
		`unit:${UNIT}`,
		`file:${LEGACY}`,
		`file:${LEGACY}`,
		`file:${LEGACY}`
	]);
	expect([...result.direct]).toEqual([UNIT]);
	expect(result.changed).toMatchObject([{ unit: UNIT }, { unit: UNIT }]);

	recordExampleCases(
		{
			unitId: 'function.impact-seeds',
			symbol: 'impactSeeds',
			state: 'changed-unit-manifest-seeds-its-unit-and-owned-files',
			evidence: 'examples-cases',
			file: 'changed-unit-manifest-seeds-its-unit-and-owned-files.json'
		},
		[
			{
				name: 'manifest change and removed owned file on both sides',
				input: { changes: MANIFEST_CHANGE, sides },
				output: summarise(result)
			}
		]
	);
});
