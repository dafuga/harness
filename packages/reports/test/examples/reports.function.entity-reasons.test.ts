import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { writingCount, writingLimits } from '../../../../src/utils/writing-limits/writingLimits';
import type { HarnessExplanation } from '../../src/models/explorer-ui/Harness.types';
import { entityReasons } from '../../src/utils/explorer-ui/entityReasons';
import { reasonsTried } from '../../src/components/explorer-ui/entity-history-row/entityReasons';
import { reasonUses } from '../../src/components/explorer-ui/entity-reasons/entityReasons';
import type { Cases } from './reports.function.entity-reasons.test.types';

const unitId = 'reports.function.entity-reasons';
const unchanged = 'Registration only; implementation unchanged.';
const long = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');

const reason = (symbol: string, changed: Partial<HarnessExplanation> = {}): HarnessExplanation => ({
	unit: 'app.function.cpu-client',
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `${symbol} reads one sample.`,
	simplification: { attempt: unchanged, outcome: 'not-applicable' },
	performance: { attempt: unchanged, outcome: 'not-applicable' },
	...changed
});

const within = (text: string, limit: { words: number | null; characters: number }) => {
	const { words, characters } = writingCount(text);
	return (limit.words === null || words <= limit.words) && characters <= limit.characters;
};

const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

test('Summarizes a selected entity reasons within limits and keeps each note and attempt', () => {
	const reasons = [
		reason('cpuSample', { behavior: long, file: 'src/utils/cpuSample.ts', change: 'added' }),
		reason('cpuClient'),
		reason('*', {
			behavior: 'cpuClient reads one sample.',
			performance: { attempt: 'Cached the sample for a second.', outcome: 'improved' }
		})
	];
	const found = entityReasons(reasons);
	expect(within(found.behavior.text, writingLimits.behavior)).toBe(true);
	expect(found.behavior.cut).toBe(true);
	expect(within(found.performance.text, writingLimits.attempt)).toBe(true);
	expect(found.performance.outcomes).toEqual(['not applicable', 'improved']);
	expect(found.long).toBe(true);
	expect(found.notes).toEqual([
		{ behavior: long, subjects: ['cpu sample'] },
		{ behavior: 'cpuClient reads one sample.', subjects: ['cpu client', 'the whole entity'] }
	]);
	// The source file and change of each reason are not read into the summary.
	expect(JSON.stringify(found)).not.toContain('src/utils');
	record('entityReasons', 'entity-reasons-summarize-selected-entity-changes', [
		{
			name: 'selected entity reasons keep every note and attempt within limits',
			input: { reasons },
			output: found
		}
	]);
});

test('Groups the uses of an attempt by kind and outcome, and keeps repeated subjects', () => {
	const [tried] = entityReasons([
		reason('cpuSample'),
		reason('cpuClient', { simplification: { attempt: unchanged, outcome: 'improved' } })
	]).attempted;
	const grouped = reasonUses(tried.uses);
	expect(grouped).toEqual([
		{ kind: 'simplification', outcome: 'not applicable', subjects: ['cpu sample'] },
		{ kind: 'performance', outcome: 'not applicable', subjects: ['cpu sample', 'cpu client'] },
		{ kind: 'simplification', outcome: 'improved', subjects: ['cpu client'] }
	]);
	const repeated = [
		{ subject: 'cpu sample', kind: 'performance' as const, outcome: 'not applicable' },
		{ subject: 'cpu sample', kind: 'performance' as const, outcome: 'not applicable' }
	];
	expect(reasonUses(repeated)).toEqual([
		{ kind: 'performance', outcome: 'not applicable', subjects: ['cpu sample', 'cpu sample'] }
	]);
	record('reasonUses', 'entity-reasons-classify-uses-by-kind-and-outcome', [
		{
			name: 'uses of one attempt grouped by kind and outcome in input order',
			input: { uses: tried.uses },
			output: grouped
		},
		{
			name: 'a subject listed twice in the input is listed twice in its group',
			input: { uses: repeated },
			output: reasonUses(repeated)
		}
	]);
});

test('Absent rows show no summary and no tried text, and blank attempts are left out', () => {
	const none = { text: '', cut: false };
	const empty = entityReasons([]);
	expect(empty).toEqual({
		behavior: none,
		simplification: { ...none, outcomes: [] },
		performance: { ...none, outcomes: [] },
		notes: [],
		attempted: [],
		long: false
	});
	expect(reasonsTried(empty)).toEqual([]);
	const blank = entityReasons([
		reason('cpuSample', {
			simplification: { attempt: '  ', outcome: 'not-applicable' },
			performance: { attempt: '', outcome: 'not-applicable' }
		})
	]);
	expect(reasonsTried(blank)).toEqual([]);
	record('reasonsTried', 'entity-reasons-absent-rows-show-nothing', [
		{
			name: 'a row with no recorded reasons has no tried text',
			input: { reasons: [] },
			output: reasonsTried(empty)
		},
		{
			name: 'blank attempts are left out of the tried list',
			input: { attempts: ['  ', ''] },
			output: reasonsTried(blank)
		}
	]);
});
