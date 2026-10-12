import { expect, test } from 'vitest';
import { commitMessage, commitPrefixes, writtenMessage } from '../../src/utils/commitMessage';

const words = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');
/** A subject of exactly this many characters, with its prefix. */
const subject = (length: number) => `feat: ${'s'.repeat(length - 6)}`;

test('a subject at its limit and a body at both of its limits pass', () => {
	expect(commitMessage(subject(72))).toEqual([]);
	expect(commitMessage(`${subject(72)}\n\n${words(60)}`)).toEqual([]);
	expect(commitMessage(`fix: short\n\n${'b'.repeat(400)}`)).toEqual([]);
	for (const prefix of commitPrefixes)
		expect(commitMessage(`${prefix} say what changed`)).toEqual([]);
});

test('one character or one word more is refused, with the count and the limit', () => {
	expect(commitMessage(subject(73))).toEqual(['subject has 73 characters; the limit is 72.']);
	expect(commitMessage(`chore: short\n\n${words(61)}`)).toEqual([
		'body has 61 words; the limit is 60.'
	]);
	// One token as long as a paragraph is one word, and still too long.
	expect(commitMessage(`chore: short\n\n${'b'.repeat(401)}`)).toEqual([
		'body has 401 characters; the limit is 400.'
	]);
	// The trailers are part of the body: they are counted with it.
	const trailer = 'Co-Authored-By: Someone Else <someone@example.invalid>';
	expect(commitMessage(`chore: short\n\n${words(58)}\n\n${trailer}`)).toEqual([
		'body has 62 words; the limit is 60.'
	]);
});

test('a subject is required, and it starts with one of the four prefixes', () => {
	expect(commitMessage('')).toEqual(['subject is empty.']);
	expect(commitMessage('\n\nonly a body')).toEqual(['subject is empty.']);
	const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
	for (const wrong of ['add the navbar', 'Feat: add the navbar', 'feat:add the navbar', 'feat:'])
		expect([wrong, commitMessage(wrong)]).toEqual([wrong, [unprefixed]]);
	expect(commitMessage(`docs: ${'s'.repeat(70)}`)).toEqual([
		'subject has 76 characters; the limit is 72.',
		unprefixed
	]);
});

test('line endings count once and characters are code points, whatever they are made of', () => {
	// Seventy-two code points, of which the last is outside the basic plane.
	expect(commitMessage(`feat: ${'é'.repeat(65)}𝄞`)).toEqual([]);
	expect(commitMessage(`feat: ${'é'.repeat(66)}𝄞`)).toEqual([
		'subject has 73 characters; the limit is 72.'
	]);
	const lines = Array.from({ length: 100 }, () => 'abc').join('\r\n');
	expect(commitMessage(`fix: short\r\n\r\n${lines}`)).toEqual([
		'body has 100 words; the limit is 60.'
	]);
	expect(
		commitMessage(`fix: short\r\n\r\n${Array.from({ length: 60 }, () => 'abcde').join('\r\n')}`)
	).toEqual([]);
});

test('a stored message is counted as it is: a paragraph that starts with a hash is part of it', () => {
	expect(commitMessage(`fix: short\n\n# ${'x'.repeat(700)}`)).toEqual([
		'body has 702 characters; the limit is 400.'
	]);
});

test('a message file loses what Git itself leaves out of the commit, and nothing else', () => {
	const file = [
		'feat: add the navbar',
		'',
		'Why it was needed.',
		'# Please enter the commit message for your changes. Lines starting',
		"# with '#' will be ignored, and an empty message aborts the commit.",
		'# ------------------------ >8 ------------------------',
		'# Do not modify or remove the line above.',
		'diff --git a/file b/file',
		`+${'x'.repeat(900)}`
	].join('\n');
	expect(writtenMessage(file)).toBe('feat: add the navbar\n\nWhy it was needed.');
	expect(commitMessage(writtenMessage(file))).toEqual([]);
	// Another comment character is honoured, and then a hash is a hash.
	expect(writtenMessage('fix: a\n\n# kept\n; dropped', { comment: ';' })).toBe('fix: a\n\n# kept');
	// A repository that keeps messages as written, or cuts at the scissors alone, keeps the hash.
	for (const cleanup of ['whitespace', 'verbatim'])
		expect(writtenMessage('fix: a\n\n# kept', { cleanup })).toBe('fix: a\n\n# kept');
	expect(
		writtenMessage(`fix: a\n\n# kept\n${file.split('\n').slice(5).join('\n')}`, {
			cleanup: 'scissors'
		})
	).toBe('fix: a\n\n# kept');
});
