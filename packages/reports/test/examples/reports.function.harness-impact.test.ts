import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	harnessImpact,
	comparedSides
} from '../../src/components/explorer-ui/harness-compare/harnessImpact';
import type { Groups } from '../../src/components/explorer-ui/harness-compare/harnessImpact.types';
import type { HarnessImpact, ComparedSides } from '../../src/utils/explorer-ui/harnessImpact';
import type {
	Unit,
	Revision,
	SourceImpact,
	Client
} from './reports.function.harness-impact.test.types';

const NO_GROUPS: Groups = { direct: [], indirect: [], added: [], removed: [] };

function meta(symbol: string, title: string) {
	const state = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return {
		unitId: 'reports.function.harness-impact',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function unit(id: string, version: string, dependsOn: string[] = [], status = 'active'): Unit {
	const dependencies = dependsOn.map((target) => ({ unit: target }));
	return { id, version, status, dependencies } as unknown as Unit;
}

function registry(
	units: Unit[],
	scenarios: Array<{ id: string; units: string[] }> = []
): Revision['registry'] {
	return {
		available: true,
		units,
		scenarios,
		graph: { edges: [] }
	} as unknown as Revision['registry'];
}

function revision(commit: string, fields: Partial<Revision> = {}): Revision {
	const empty = registry([]);
	return { commit, registry: empty, comparison: null, sourceImpact: null, ...fields } as Revision;
}

function sourceOf(
	base: string,
	units: Partial<Groups>,
	changed: string[] = [],
	scenarios: string[] = []
): SourceImpact {
	const files = changed.map((path) => ({ path }));
	return {
		base,
		expanded: false,
		changed: files,
		units: { ...NO_GROUPS, ...units },
		scenarios,
		uncertain: []
	} as unknown as SourceImpact;
}

function fakeClient(side: (path: string) => Promise<unknown>): Client {
	return { side } as unknown as Client;
}

function summary(impact: HarnessImpact) {
	return {
		source: impact.source,
		expanded: impact.expanded,
		files: impact.files,
		record: impact.record,
		direct: impact.direct,
		indirect: impact.indirect,
		added: impact.added,
		removed: impact.removed,
		scenarios: impact.scenarios,
		uncertain: impact.uncertain,
		marks: Object.fromEntries(impact.marks)
	};
}

test('Recorded comparison applies only to the base it names', () => {
	const head = revision('head-b', {
		comparison: {
			base: 'base-a',
			record: 'record-1',
			units: { direct: ['x'], indirect: ['y'], added: [], removed: [] },
			scenarios: ['s2', 's1', 's2'],
			uncertain: []
		},
		sourceImpact: sourceOf('base-a', { direct: ['z'] })
	});
	const matched = summary(harnessImpact(revision('base-a'), head));
	const other = summary(harnessImpact(revision('base-x'), head));
	expect(matched).toMatchObject({
		source: 'recorded',
		record: 'record-1',
		direct: ['x'],
		indirect: ['y'],
		scenarios: ['s1', 's2']
	});
	expect(other.source).toBe('computed');
	recordExampleCases(
		meta('harnessImpact', 'Recorded comparison applies only to the base it names'),
		[
			{
				name: 'base is the one the record compared',
				input: { base: 'base-a', head: 'head-b' },
				output: matched
			},
			{ name: 'base is another revision', input: { base: 'base-x', head: 'head-b' }, output: other }
		]
	);
});

test('Source impact sorts added units out of direct', () => {
	const head = revision('head-b', {
		sourceImpact: sourceOf(
			'base-a',
			{ direct: ['u1', 'u2', 'u3'], indirect: ['u1', 'u4'], added: ['u2'] },
			['a.ts', 'b.ts'],
			['s2', 's1', 's2']
		)
	});
	const matched = summary(harnessImpact(revision('base-a'), head));
	const other = summary(harnessImpact(revision('base-q'), head));
	expect(matched).toMatchObject({
		source: 'source',
		files: 2,
		direct: ['u1', 'u3'],
		added: ['u2'],
		indirect: ['u1', 'u4'],
		scenarios: ['s1', 's2']
	});
	expect(matched.marks).toEqual({ u1: 'direct', u2: 'added', u3: 'direct', u4: 'indirect' });
	expect(other.source).toBe('computed');
	recordExampleCases(meta('harnessImpact', 'Source impact sorts added units out of direct'), [
		{
			name: 'source impact names this base',
			input: { base: 'base-a', head: 'head-b' },
			output: matched
		},
		{
			name: 'source impact names another base',
			input: { base: 'base-q', head: 'head-b' },
			output: other
		}
	]);
});

test('Computed impact compares active registries', () => {
	const base = revision('base-a', {
		registry: registry(
			[
				unit('a', '1'),
				unit('b', '1'),
				unit('c', '1', ['a']),
				unit('old', '1'),
				unit('gone', '1', [], 'retired')
			],
			[{ id: 's-old', units: ['old'] }]
		)
	});
	const head = revision('head-b', {
		registry: registry(
			[unit('a', '2'), unit('b', '1'), unit('c', '1', ['a']), unit('d', '1', ['c'])],
			[
				{ id: 's-c', units: ['c'] },
				{ id: 's-b', units: ['b'] }
			]
		)
	});
	const changed = summary(harnessImpact(base, head));
	const fromNothing = summary(harnessImpact(undefined, head));
	expect(changed).toMatchObject({
		source: 'computed',
		direct: ['a'],
		indirect: ['c'],
		added: ['d'],
		removed: ['old'],
		scenarios: ['s-c', 's-old'],
		uncertain: []
	});
	expect(changed.marks).toEqual({ a: 'direct', c: 'indirect', d: 'added', old: 'removed' });
	expect(fromNothing.added).toEqual(['a', 'b', 'c', 'd']);
	recordExampleCases(meta('harnessImpact', 'Computed impact compares active registries'), [
		{
			name: 'base and head registries differ',
			input: { base: 'base-a', head: 'head-b' },
			output: changed
		},
		{
			name: 'no base selected lists every active unit as added',
			input: { base: null, head: 'head-b' },
			output: fromNothing
		}
	]);
});

test('Compared sides replace source impact only for the same commits', () => {
	const head = revision('head-b', {
		sourceImpact: sourceOf('base-a', { direct: ['from-source'] })
	});
	const compared: ComparedSides = {
		base: 'base-a',
		head: 'head-b',
		impact: sourceOf('base-a', { direct: ['from-compared'] }, ['c.ts'])
	};
	const other: ComparedSides = { ...compared, head: 'head-z' };
	const replaced = summary(harnessImpact(revision('base-a'), head, compared));
	const kept = summary(harnessImpact(revision('base-a'), head, other));
	expect(replaced.direct).toEqual(['from-compared']);
	expect(kept.direct).toEqual(['from-source']);
	recordExampleCases(
		meta('harnessImpact', 'Compared sides replace source impact only for the same commits'),
		[
			{
				name: 'precomputed sides name the same commits',
				input: { compared: 'base-a..head-b' },
				output: replaced
			},
			{
				name: 'precomputed sides name another head',
				input: { compared: 'base-a..head-z' },
				output: kept
			}
		]
	);
});

test('comparedSides returns undefined when a side is absent', async () => {
	const loads: string[] = [];
	const client = fakeClient((path) => {
		loads.push(path);
		return Promise.resolve({});
	});
	const absentBase = await comparedSides(
		client,
		revision('base-a'),
		revision('head-b', { side: 'side-head' })
	);
	const absentHead = await comparedSides(
		client,
		revision('base-a', { side: 'side-base' }),
		revision('head-b')
	);
	expect(absentBase).toBeUndefined();
	expect(absentHead).toBeUndefined();
	expect(loads).toEqual([]);
	recordExampleCases(
		meta('comparedSides', 'comparedSides returns undefined when a side is absent'),
		[
			{
				name: 'base has no stored side',
				input: { base: 'base-a', head: 'head-b' },
				output: { returned: absentBase ?? null, loads: loads.length }
			},
			{
				name: 'head has no stored side',
				input: { base: 'base-a', head: 'head-b' },
				output: { returned: absentHead ?? null, loads: loads.length }
			}
		]
	);
});

test('comparedSides rejects when a stored side fails to load', async () => {
	const failing = fakeClient((path) =>
		path === 'side-base'
			? Promise.reject(new Error('side-base could not be loaded (404)'))
			: Promise.resolve({})
	);
	const base = revision('base-a', { side: 'side-base' });
	const head = revision('head-b', { side: 'side-head' });
	const message = 'side-base could not be loaded (404)';
	await expect(comparedSides(failing, base, head)).rejects.toThrow(message);
	recordExampleCases(
		meta('comparedSides', 'comparedSides rejects when a stored side fails to load'),
		[
			{
				name: 'base side response is not ok',
				input: { base: 'side-base', head: 'side-head' },
				error: message
			}
		]
	);
});
