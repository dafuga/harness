import { expect, test } from 'vitest';
import { matchesPattern } from '../../src/utils/matchesPattern';

const hex = /^[a-f0-9]{4}$/;

test('matchesPattern accepts a text of the pattern', () => {
	expect(matchesPattern('a1b2', hex)).toBe(true);
});

test('matchesPattern refuses another text and whatever is not a text', () => {
	for (const value of [
		'a1b',
		'a1b2c',
		'A1B2',
		'',
		1234,
		null,
		undefined,
		['a1b2'],
		{ length: 4 }
	]) {
		expect(matchesPattern(value, hex), JSON.stringify(value)).toBe(false);
	}
});

test('matchesPattern gives the same answer every time, also for a global pattern', () => {
	const global = /[a-f0-9]{4}/g;
	expect([1, 2, 3].map(() => matchesPattern('a1b2', global))).toEqual([true, true, true]);
});
