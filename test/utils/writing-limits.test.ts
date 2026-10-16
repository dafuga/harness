import { expect, test } from 'vitest';
import {
	explanationProblems,
	writingCount,
	writingDeclared,
	writingLimits,
	writingProblems
} from '../../src/utils/writingLimits';

const words = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');
const reason = (extra: object = {}) => ({
	unit: 'function.slugify',
	symbol: 'slugify',
	behavior: 'Keeps long titles unchanged.',
	simplification: { attempt: 'One guard clause.', outcome: 'not-improved' as const },
	performance: { attempt: 'Not measured.', outcome: 'not-applicable' as const },
	...extra
});

test('the limits are the ones every check shares', () => {
	expect(writingLimits).toEqual({
		behavior: { words: 30, characters: 200 },
		attempt: { words: 20, characters: 140 },
		subject: { words: null, characters: 72 },
		body: { words: 60, characters: 400 }
	});
});

test('words are separated by any whitespace after trimming, and characters are code points', () => {
	expect(writingCount('  one\ttwo\n\nthree  ')).toEqual({ words: 3, characters: 14 });
	expect(writingCount('')).toEqual({ words: 0, characters: 0 });
	// A line ending is one character however it was typed, and an emoji is one, not two.
	expect(writingCount('a\r\nb').characters).toBe(3);
	expect(writingCount('naïve 😀 café').characters).toBe(12);
});

test('exactly the limit passes, and one word or one character more does not', () => {
	const limit = writingLimits.behavior;
	expect(writingProblems('behavior', words(30, 'ab'), limit)).toEqual([]);
	expect(writingProblems('behavior', words(31, 'ab'), limit)).toEqual([
		'behavior has 31 words; the limit is 30.'
	]);
	expect(writingProblems('behavior', 'x'.repeat(200), limit)).toEqual([]);
	// One giant token is one word and still too long.
	expect(writingProblems('behavior', 'x'.repeat(201), limit)).toEqual([
		'behavior has 201 characters; the limit is 200.'
	]);
	expect(writingProblems('behavior', '   ', limit)).toEqual(['behavior is empty.']);
	expect(writingProblems('behavior', words(31, 'x'.repeat(9)), limit)).toHaveLength(2);
});

test('a reason is held to the limit of each of its three parts, and names what it is about', () => {
	expect(explanationProblems(reason(), 1)).toEqual([]);
	const edge = reason({
		behavior: words(30, 'ab'),
		simplification: { attempt: words(20, 'ab'), outcome: 'improved' },
		performance: { attempt: 'y'.repeat(140), outcome: 'not-applicable' }
	});
	expect(explanationProblems(edge, 1)).toEqual([]);
	const long = reason({
		behavior: words(31),
		simplification: { attempt: words(21), outcome: 'improved' },
		performance: { attempt: 'y'.repeat(141), outcome: 'not-applicable' }
	});
	expect(explanationProblems(long, 1)).toEqual([
		'function.slugify slugify: behavior has 31 words; the limit is 30.',
		'function.slugify slugify: simplification attempt has 21 words; the limit is 20.',
		'function.slugify slugify: performance attempt has 141 characters; the limit is 140.'
	]);
	const whole = reason({ symbol: '*', behavior: ' ' });
	expect(explanationProblems(whole, 1)).toEqual(['function.slugify: behavior is empty.']);
});

test('a repository adopts the limits by what its verification config declares', () => {
	expect(writingDeclared(JSON.stringify({ schemaVersion: 1, writing: 1 }))).toBe(true);
	expect(writingDeclared(JSON.stringify({ schemaVersion: 1 }))).toBe(false);
	expect(writingDeclared(JSON.stringify({ writing: 0 }))).toBe(false);
	expect(writingDeclared('not json')).toBe(false);
	expect(writingDeclared(undefined)).toBe(false);
});
