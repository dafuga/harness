import type { Cases } from './function.writing-limits.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { writingDeclared } from '../../src/services/git-source-history/commit-message-service/writingLimits';
import {
	explanationProblems,
	writingCount,
	writingHeld,
	writingLimits,
	writingPolicy,
	writingProblems
} from '../../src/utils/git-source-history/writing-limits/writingLimits';
import type {
	WritingLimit,
	WrittenReason
} from '../../src/utils/git-source-history/writing-limits/writingLimits.types';

const unit = 'function.writing-limits';

function record(state: string, symbol: string, cases: Cases): boolean {
	return recordExampleCases(
		{ unitId: unit, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function words(count: number): string {
	return Array.from({ length: count }, () => 'word').join(' ');
}

function reason(
	symbol: string,
	behavior: string,
	simplification: string,
	performance: string
): WrittenReason {
	return {
		unit,
		symbol,
		behavior,
		simplification: { attempt: simplification },
		performance: { attempt: performance }
	};
}

test('Holds a revision to the newest version its config declares', () => {
	const configs = ['{"writing": 2}', '{"writing": 3}', '{"writing": 1.5}', '{"writing": 0}'];
	const cases = configs.map((config) => ({
		name: `config ${config}`,
		input: config,
		output: writingHeld(config)
	}));

	expect(cases.map((item) => item.output)).toEqual([2, 2, 1, null]);
	record('holds-a-revision-to-the-newest-version-its-config-declares', 'writingHeld', cases);
});

test('Declares the limits only with a version of 1 or more', () => {
	const cases = [
		{
			name: 'a config declaring writing 2',
			input: '{"writing": 2}',
			output: writingDeclared('{"writing": 2}')
		},
		{
			name: 'a config declaring writing 0',
			input: '{"writing": 0}',
			output: writingDeclared('{"writing": 0}')
		},
		{ name: 'no config at all', input: null, output: writingDeclared(undefined) },
		{ name: 'a config that is not JSON', input: 'not json', output: writingDeclared('not json') }
	];

	expect(cases.map((item) => item.output)).toEqual([true, false, false, false]);
	record('declares-the-limits-only-with-a-version-of-1-or-more', 'writingDeclared', cases);
});

test('Counts words and code points after normalising newlines', () => {
	const texts = [
		'Fix stale evidence-grid cache after rename',
		'Keep the grid readable on narrow screens\r\n\r\nRows wrap instead of scrolling sideways.',
		'',
		'🙂 ok'
	];
	const cases = texts.map((text) => ({
		name: `text of ${text.length} UTF-16 units`,
		input: text,
		output: writingCount(text)
	}));

	expect(cases.map((item) => item.output)).toEqual([
		{ words: 6, characters: 42 },
		{ words: 13, characters: 82 },
		{ words: 0, characters: 0 },
		{ words: 2, characters: 4 }
	]);
	record('counts-words-and-code-points-after-normalising-newlines', 'writingCount', cases);
});

test('Reports empty and over-limit text', () => {
	const checks: Array<{ name: string; field: string; text: string; limit: WritingLimit }> = [
		{ name: 'empty behavior note', field: 'behavior', text: '', limit: writingLimits.behavior },
		{
			name: 'behavior note of 31 words',
			field: 'behavior',
			text: words(31),
			limit: writingLimits.behavior
		},
		{
			name: 'body of one 401-character token',
			field: 'body',
			text: 'a'.repeat(401),
			limit: writingLimits.body
		},
		{
			name: 'subject of 73 characters',
			field: 'subject',
			text: 'a'.repeat(73),
			limit: writingLimits.subject
		}
	];
	const cases = checks.map(({ name, field, text, limit }) => ({
		name,
		input: { field, text, limit },
		output: writingProblems(field, text, limit)
	}));

	expect(cases.map((item) => item.output)).toEqual([
		['behavior is empty.'],
		['behavior has 31 words; the limit is 30.'],
		['body has 401 characters; the limit is 400.'],
		['subject has 73 characters; the limit is 72.']
	]);
	record('reports-empty-and-over-limit-text', 'writingProblems', cases);
});

test('Gives each attempt the word limit of its judged version', () => {
	const attemptReason = reason(
		'writingHeld',
		'Reads the writing version a config declares and holds the revision to the newest version not above it.',
		words(17),
		'Parse the verification config once per call.'
	);
	const cases = [
		{ name: 'version 1 policy attempt', input: 1, output: writingPolicy(1).attempt },
		{ name: 'version 2 policy attempt', input: 2, output: writingPolicy(2).attempt },
		{
			name: 'a 17-word simplification judged under version 2',
			input: { reason: attemptReason, version: 2 },
			output: explanationProblems(attemptReason, 2)
		},
		{
			name: 'a 17-word simplification judged under version 1',
			input: { reason: attemptReason, version: 1 },
			output: explanationProblems(attemptReason, 1)
		}
	];

	expect(cases.map((item) => item.output)).toEqual([
		{ words: 20, characters: 140 },
		{ words: 15, characters: 140 },
		[`${unit} writingHeld: simplification attempt has 17 words; the limit is 15.`],
		[]
	]);
	record('gives-each-attempt-the-word-limit-of-its-judged-version', 'writingPolicy', cases);
});

test('Prefixes each explanation problem with unit and symbol', () => {
	const checks = [
		{
			name: 'behavior of 31 words on one symbol',
			item: reason(
				'writingHeld',
				words(31),
				'Search the version list from newest to oldest.',
				'Parse the verification config once per call.'
			)
		},
		{
			name: 'empty performance attempt on the whole unit',
			item: reason('*', 'Counts note and commit text one way.', 'Share one counting path.', '')
		},
		{
			name: 'a reason within every limit',
			item: reason(
				'writingCount',
				'Counts words and code points after normalising line endings.',
				'Share one counting path.',
				'Count each text once per check.'
			)
		}
	];
	const cases = checks.map(({ name, item }) => ({
		name,
		input: { reason: item, version: 2 },
		output: explanationProblems(item, 2)
	}));

	expect(cases.map((item) => item.output)).toEqual([
		[`${unit} writingHeld: behavior has 31 words; the limit is 30.`],
		[`${unit}: performance attempt is empty.`],
		[]
	]);
	record('prefixes-each-explanation-problem-with-unit-and-symbol', 'explanationProblems', cases);
});
