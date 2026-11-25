import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { comparisonPanes } from '../../src/helpers/verification-evidence/comparisonPanes';
import type {
	ComparisonPane,
	ComparisonSide
} from '../../src/helpers/verification-evidence/comparisonPanes.types';
import type { Result } from './reports.helper.verification-evidence-comparison-panes.test.types';

const UNIT_ID = 'reports.helper.verification-evidence-comparison-panes';
const PARENT = '0123456789abcdef0123456789abcdef01234567';
const SELECTED = '89abcdef0123456789abcdef0123456789abcdef';
const DEFAULT_GAP = 'No evidence is recorded for this side.';

const beforeSide: ComparisonSide<Result> = {
	value: { checks: 12, passed: true },
	commit: PARENT,
	key: `before-${PARENT}`,
	gap: 'Parent revision has no additional evidence notes.',
	currentLabel: 'Current snapshot',
	currentRole: 'Branch tip'
};

const afterSide: ComparisonSide<Result> = {
	value: { checks: 14, passed: true },
	commit: SELECTED,
	key: `after-${SELECTED}`,
	gap: 'One check has no attached output.',
	currentLabel: 'Current snapshot',
	currentRole: 'Branch tip'
};

function summarise<T>(pane: ComparisonPane<T>): Record<string, unknown> {
	return {
		key: pane.key,
		side: pane.side,
		phase: pane.phase,
		commit: pane.commit,
		heading: pane.heading,
		role: pane.role,
		value: pane.value ?? null,
		gap: pane.gap ?? null
	};
}

function captureError(run: () => unknown): { name: string; message: string } {
	let error: unknown;
	try {
		run();
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	expect(actual.message).toBe('commit getter failed');
	return { name: actual.name, message: actual.message };
}

function throwingAfter(): ComparisonSide<Result> {
	return {
		get commit(): string {
			throw new Error('commit getter failed');
		}
	};
}

test('Pairs before and after panes with their own commit headings', () => {
	const panes = comparisonPanes(beforeSide, afterSide);
	expect(panes.map((pane) => pane.side)).toEqual(['before', 'after']);
	expect(panes[0].phase).toBe('before');
	expect(panes[1].role).toBe('Selected commit');
	expect(panes[0].heading.startsWith('Before · ')).toBe(true);
	expect(panes[1].heading.startsWith('After · ')).toBe(true);
	expect(panes[0].value).toEqual(beforeSide.value);
	expect(panes[1].gap).toBe(afterSide.gap);

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'comparisonPanes',
			state: 'pairs-before-and-after-panes-with-their-own-commit-headings',
			evidence: 'examples-cases',
			file: 'pairs-before-and-after-panes-with-their-own-commit-headings.json'
		},
		[
			{
				name: 'pairs parent and selected commits',
				input: { before: beforeSide, after: afterSide },
				output: panes.map(summarise)
			}
		]
	);
});

test('Fills an empty before side and default gap', () => {
	const panes = comparisonPanes(null, { commit: null });
	expect(panes[0].commit).toBe('');
	expect(panes[0].heading).toBe('Before');
	expect(panes[0].gap).toBe(DEFAULT_GAP);
	expect(panes[1].commit).toBe('');
	expect(panes[1].key).toBe('after-');
	expect(panes[1].gap).toBe(DEFAULT_GAP);

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'comparisonPanes',
			state: 'fills-an-empty-before-side-and-default-gap',
			evidence: 'examples-cases',
			file: 'fills-an-empty-before-side-and-default-gap.json'
		},
		[
			{
				name: 'null before and after without commit or value',
				input: { before: null, after: { commit: null } },
				output: panes.map(summarise)
			}
		]
	);
});

test('Builds one current pane when paired is false', () => {
	const withMetadata = comparisonPanes(beforeSide, afterSide, false);
	const bare = comparisonPanes(null, { value: { checks: 1, passed: false } }, false);
	expect(withMetadata).toHaveLength(1);
	expect(withMetadata[0].phase).toBe('current');
	expect(withMetadata[0].side).toBe('after');
	expect(withMetadata[0].role).toBe('Branch tip');
	expect(withMetadata[0].heading.startsWith('Current snapshot · ')).toBe(true);
	expect(bare[0].heading).toBe('Current snapshot');
	expect(bare[0].role).toBe('Branch tip');

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'comparisonPanes',
			state: 'builds-one-current-pane-when-paired-is-false',
			evidence: 'examples-cases',
			file: 'builds-one-current-pane-when-paired-is-false.json'
		},
		[
			{
				name: 'unpaired pane with current label and commit',
				input: { before: beforeSide, after: afterSide, paired: false },
				output: withMetadata.map(summarise)
			},
			{
				name: 'unpaired pane without commit or label',
				input: { before: null, after: { value: { checks: 1, passed: false } }, paired: false },
				output: bare.map(summarise)
			}
		]
	);
});

test('Propagates a throwing side getter without wrapping it', () => {
	const error = captureError(() => comparisonPanes(null, throwingAfter()));

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'comparisonPanes',
			state: 'propagates-a-throwing-side-getter-without-wrapping-it',
			evidence: 'examples-cases',
			file: 'propagates-a-throwing-side-getter-without-wrapping-it.json'
		},
		[
			{
				name: 'after.commit getter throws',
				input: { before: null, after: 'commit getter throws' },
				error
			}
		]
	);
});
