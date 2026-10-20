import { expect, test } from 'vitest';
import {
	commitMessage,
	writtenMessage
} from '../../src/services/commit-message-service/commitMessage';
import { commitPrefixes } from '../../src/utils/commitMessage';

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

const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
const cleaned = ['strip', 'whitespace', 'scissors'];
const cut = '# ------------------------ >8 ------------------------';
const diff = `diff --git a/file b/file\n+${'x'.repeat(900)}\n`;

test('a message file is cleaned as Git cleans it: whitespace Git never stores is not counted', () => {
	// What was refused as 420 characters: five letters, 410 spaces after them, and a second line.
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	for (const cleanup of cleaned) {
		const stored = writtenMessage(padded, { cleanup });
		expect([cleanup, stored, commitMessage(stored)]).toEqual([
			cleanup,
			'feat: parity\n\nalpha\nbeta',
			[]
		]);
	}
	// Blank lines before, after and in a row go; a line of spaces is a blank line; what a line
	// begins with stays.
	const untidy = '\n \n\t\nfeat: tidy \t\r\n\n\n  \n  indented stays \n\n\n\nlast\r\n\n \n';
	for (const cleanup of cleaned)
		expect([cleanup, writtenMessage(untidy, { cleanup })]).toEqual([
			cleanup,
			'feat: tidy\n\n  indented stays\n\nlast'
		]);
	// A comment that is left out leaves no line behind, and the blank lines around one are one.
	expect(writtenMessage('fix: a \n# gone\nb\n\n# gone\n\nc\n')).toBe('fix: a\nb\n\nc');
	// Only a space, a tab and a line ending end a line for Git: other blanks are content.
	const odd = 'fix: a\n\nb\u00a0\nc\f\nd\n';
	expect(writtenMessage(odd, { cleanup: 'whitespace' })).toBe('fix: a\n\nb\u00a0\nc\f\nd');
});

test('what is left after the cleaning is still measured, and a prefix is still required', () => {
	const body = (letters: number) => `fix: short \n\n\n${'b'.repeat(letters)}   \n\n\n`;
	expect(commitMessage(writtenMessage(body(400)))).toEqual([]);
	expect(commitMessage(writtenMessage(body(401)))).toEqual([
		'body has 401 characters; the limit is 400.'
	]);
	const spaced = `fix: short\n\n${words(61).replaceAll(' ', '  \n\n\n')}\n`;
	expect(commitMessage(writtenMessage(spaced))).toEqual(['body has 61 words; the limit is 60.']);
	expect(commitMessage(writtenMessage('\n\nadd the navbar   \n\n'))).toEqual([unprefixed]);
	// A stored message is read without what is blank at its two ends, and so is the file: what
	// the subject is indented by is not held against it, by the hook or by the verification.
	expect(commitMessage(writtenMessage('  feat: indented\n'))).toEqual([]);
	expect(writtenMessage(' \n\t feat: a\n\n  b \n\u00a0\n')).toBe('feat: a\n\n  b');
	expect(commitMessage(writtenMessage(' \n# only a comment\n\t\n'))).toEqual(['subject is empty.']);
});

test('a repository that keeps messages as written is measured as written', () => {
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	expect(writtenMessage(padded, { cleanup: 'verbatim' })).toBe(padded.trim());
	expect(commitMessage(writtenMessage(padded, { cleanup: 'verbatim' }))).toEqual([
		'body has 420 characters; the limit is 400.'
	]);
	expect(writtenMessage('fix: a\n\n\n# kept  \n\n\nb', { cleanup: 'verbatim' })).toBe(
		'fix: a\n\n\n# kept  \n\n\nb'
	);
});

test('the scissors are the whole line Git writes, in every mode that cleans', () => {
	for (const cleanup of cleaned)
		expect([cleanup, writtenMessage(`fix: a\n\nwhy  \n${cut}\n${diff}`, { cleanup })]).toEqual([
			cleanup,
			'fix: a\n\nwhy'
		]);
	expect(writtenMessage(`${cut}\n${diff}`, { cleanup: 'scissors' })).toBe('');
	// A line that only begins like the scissors cuts nothing: it is a comment, or it is content.
	const near = `fix: a\n\n${cut} more\nkept  \n`;
	expect(writtenMessage(near)).toBe('fix: a\n\nkept');
	expect(writtenMessage(near, { cleanup: 'scissors' })).toBe(`fix: a\n\n${cut} more\nkept`);
	// Another comment character moves the scissors with it, and then a hash is content.
	const other = `fix: a\n\n; gone\n# kept\n;${cut.slice(1)}\n${diff}`;
	expect(writtenMessage(other, { comment: ';' })).toBe('fix: a\n\n# kept');
	expect(writtenMessage(`fix: a\n\n${cut}\nkept\n`, { comment: ';' })).toBe(
		`fix: a\n\n${cut}\nkept`
	);
});

test('a long run of spaces inside a line costs no more than the line is long', () => {
	const run = ' '.repeat(200_000);
	const started = performance.now();
	expect(writtenMessage(`fix: a\n\nb${run}c${run}\n`, { cleanup: 'whitespace' })).toBe(
		`fix: a\n\nb${run}c`
	);
	// Rescanning the run from each of its spaces took twenty seconds; one pass takes milliseconds.
	expect(performance.now() - started).toBeLessThan(2_000);
});
