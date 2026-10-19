import { expect, test } from 'vitest';
import {
	explanationProblems,
	writingHeld,
	writingLimits,
	writingPolicy,
	writingVersion,
	writingVersions
} from '../../src/utils/writing-limits/writingLimits';
import { writingDeclared } from '../../src/services/commit-message-service/writingLimits';

const words = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');
const about = 'function.slugify slugify';
/** A reason whose first attempt, or whose behaviour note, is the text under test. */
const reason = (attempt: string, behavior = 'Keeps long titles unchanged.') => ({
	unit: 'function.slugify',
	symbol: 'slugify',
	behavior,
	simplification: { attempt },
	performance: { attempt: 'Not measured.' }
});

test('the two versions differ in how many words an attempt may have, and in nothing else', () => {
	expect([writingVersions, writingVersion]).toEqual([[1, 2], 2]);
	expect(writingPolicy(1)).toEqual({
		behavior: { words: 30, characters: 200 },
		attempt: { words: 20, characters: 140 },
		subject: { words: null, characters: 72 },
		body: { words: 60, characters: 400 }
	});
	expect(writingPolicy(2)).toEqual({
		...writingPolicy(1),
		attempt: { words: 15, characters: 140 }
	});
	// What a commit message and a reader are held to has not moved: it is the widest there is.
	expect(writingLimits).toEqual(writingPolicy(1));
});

test('under version 2 an attempt of exactly 15 words passes and one of 16 does not', () => {
	expect(explanationProblems(reason(words(15)), 2)).toEqual([]);
	expect(explanationProblems(reason(words(16)), 2)).toEqual([
		`${about}: simplification attempt has 16 words; the limit is 15.`
	]);
	// Each of the two attempts is held on its own.
	const both = { ...reason(words(16)), performance: { attempt: words(17) } };
	expect(explanationProblems(both, 2)).toEqual([
		`${about}: simplification attempt has 16 words; the limit is 15.`,
		`${about}: performance attempt has 17 words; the limit is 15.`
	]);
	expect(explanationProblems({ ...both, simplification: { attempt: words(15) } }, 2)).toEqual([
		`${about}: performance attempt has 17 words; the limit is 15.`
	]);
});

test('under version 1 an attempt keeps its 20 words: 16 and 20 pass and 21 does not', () => {
	for (const count of [16, 20]) expect(explanationProblems(reason(words(count)), 1)).toEqual([]);
	expect(explanationProblems(reason(words(21)), 1)).toEqual([
		`${about}: simplification attempt has 21 words; the limit is 20.`
	]);
});

test('the behaviour note and every character ceiling are the same in both versions', () => {
	for (const version of writingVersions) {
		expect(explanationProblems(reason('One guard.', words(30, 'ab')), version)).toEqual([]);
		expect(explanationProblems(reason('One guard.', words(31, 'ab')), version)).toEqual([
			`${about}: behavior has 31 words; the limit is 30.`
		]);
		expect(explanationProblems(reason('One guard.', 'x'.repeat(200)), version)).toEqual([]);
		expect(explanationProblems(reason('One guard.', 'x'.repeat(201)), version)).toEqual([
			`${about}: behavior has 201 characters; the limit is 200.`
		]);
		expect(explanationProblems(reason('y'.repeat(140)), version)).toEqual([]);
		expect(explanationProblems(reason('y'.repeat(141)), version)).toEqual([
			`${about}: simplification attempt has 141 characters; the limit is 140.`
		]);
		expect(explanationProblems(reason(' \n '), version)).toEqual([
			`${about}: simplification attempt is empty.`
		]);
	}
});

test('characters are Unicode code points and words end at any whitespace, under the new limit too', () => {
	// An emoji is one character though it is two UTF-16 units: 140 pass and one more does not.
	expect(explanationProblems(reason('😀'.repeat(140)), 2)).toEqual([]);
	expect(explanationProblems(reason('😀'.repeat(141)), 2)).toEqual([
		`${about}: simplification attempt has 141 characters; the limit is 140.`
	]);
	expect(explanationProblems(reason('One guard.', 'é'.repeat(200)), 2)).toEqual([]);
	// Fifteen words stay fifteen across tabs, line endings and repeated spaces.
	const spaced = Array.from({ length: 15 }, (_, at) => `é${at}`).join(' \t\r\n ');
	expect(explanationProblems(reason(`  ${spaced}\n`), 2)).toEqual([]);
	expect(explanationProblems(reason(`${spaced}\néxtra`), 2)).toEqual([
		`${about}: simplification attempt has 16 words; the limit is 15.`
	]);
	// Few enough words can still be too many characters, and both are said when both are.
	expect(explanationProblems(reason(words(15, 'x'.repeat(10))), 2)).toEqual([
		`${about}: simplification attempt has 164 characters; the limit is 140.`
	]);
	expect(explanationProblems(reason(words(16, 'x'.repeat(10))), 2)).toHaveLength(2);
});

test('a revision is held to the version its verification config declares, and to none without one', () => {
	const config = (writing: unknown) => JSON.stringify({ schemaVersion: 1, writing });
	expect([writingHeld(config(1)), writingHeld(config(2))]).toEqual([1, 2]);
	expect(writingHeld(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
	for (const none of [0, -1, '2', null, true, [2]]) expect(writingHeld(config(none))).toBeNull();
	expect([writingHeld('not json'), writingHeld(undefined)]).toEqual([null, null]);
	// A later version than this Harness knows is never read as a weaker one.
	expect(writingHeld(config(3))).toBe(2);
	// A commit message asks only whether the limits are declared: both versions hold it.
	expect([1, 2, 3].map((version) => writingDeclared(config(version)))).toEqual([true, true, true]);
	expect([writingDeclared(config(0)), writingDeclared(undefined)]).toEqual([false, false]);
});
