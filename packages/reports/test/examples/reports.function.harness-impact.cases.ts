import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessImpact } from '../../src/components/explorer-ui/harness-compare/harnessImpact';
import type { Groups } from '../../src/components/explorer-ui/harness-compare/harnessImpact.types';
import type { HarnessImpact } from '../../src/utils/explorer-ui/harnessImpact';
import type { Unit, Revision, SourceImpact } from './reports.function.harness-impact.test.types';

const NO_GROUPS: Groups = { direct: [], indirect: [], added: [], removed: [] };

export function meta(symbol: string, title: string) {
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

export function registry(
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

export function revision(commit: string, fields: Partial<Revision> = {}): Revision {
	const empty = registry([]);
	return { commit, registry: empty, comparison: null, sourceImpact: null, ...fields } as Revision;
}

export function sourceOf(
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

export function summary(impact: HarnessImpact) {
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
