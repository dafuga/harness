import { expect } from 'vitest';
import type { MessageCleanup } from '../../src/utils/git-source-history/commitMessage.types';
import type {
	CommitMessageExampleCallbacks,
	CommitMessageFixture,
	CommitMessageImplementations
} from './commitMessageExamples.types';
const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
const cleaned = ['strip', 'whitespace', 'scissors'];
const cut = '# ------------------------ >8 ------------------------';
const diff = `diff --git a/file b/file\n+${'x'.repeat(900)}\n`;
const words = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');
const subject = (length: number) => `feat: ${'s'.repeat(length - 6)}`;
export function commitMessageExamples(
	implementations: CommitMessageImplementations
): CommitMessageExampleCallbacks {
	return {
		commitMessage: (...input) => invokeCommitMessage(input, implementations),
		writtenMessage: (...input) => invokeWrittenMessage(input, implementations)
	};
}
function invokeCommitMessage(input: readonly unknown[], implementations: CommitMessageImplementations): unknown {
	const fixture = fixtureOf(input);
	switch (fixture.$fixture) {
		case 'limits': return commitLimits(implementations);
		case 'limit-errors': return commitLimitErrors(implementations);
		case 'subject-prefix': return commitSubjectPrefix(implementations);
		case 'unicode-line-endings': return commitUnicode(implementations);
		case 'stored-hash': return commitStoredHash(implementations);
		case 'cleaned-message': return commitCleaned(implementations);
		default: throw new Error(`Unknown commitMessage fixture ${fixture.$fixture}`);
	}
}
function invokeWrittenMessage(input: readonly unknown[], implementations: CommitMessageImplementations): unknown {
	const fixture = fixtureOf(input);
	switch (fixture.$fixture) {
		case 'git-drops': return writtenGitDrops(implementations);
		case 'cleanup-whitespace': return writtenCleanup(implementations);
		case 'verbatim': return writtenVerbatim(implementations);
		case 'scissors': return writtenScissors(implementations);
		case 'long-spaces': return writtenLongSpaces(implementations, fixture);
		default: throw new Error(`Unknown writtenMessage fixture ${fixture.$fixture}`);
	}
}
function fixtureOf(input: readonly unknown[]): CommitMessageFixture {
	const fixture = input[0];
	if (typeof fixture !== 'object' || fixture === null || !Object.hasOwn(fixture, '$fixture'))
		throw new Error('Commit message examples require a fixture marker');
	return fixture as CommitMessageFixture;
}
function expectCommit(implementations: CommitMessageImplementations, message: string, expected: string[]): string[] {
	const actual = implementations.publicCommitMessage(message);
	expect(actual).toEqual(expected);
	expect(implementations.ownerCommitMessage(message)).toEqual(expected);
	return actual;
}
function expectWritten(implementations: CommitMessageImplementations, file: string, options: MessageCleanup, expected: string): string {
	const actual = implementations.publicWrittenMessage(file, options);
	expect(actual).toBe(expected);
	expect(implementations.ownerWrittenMessage(file, options)).toBe(expected);
	return actual;
}
function stored(implementations: CommitMessageImplementations, file: string, options: MessageCleanup = {}): string {
	const actual = implementations.publicWrittenMessage(file, options);
	expect(implementations.ownerWrittenMessage(file, options)).toBe(actual);
	return actual;
}
function commitLimits(implementations: CommitMessageImplementations): string[] {
	const atLimit = subject(72);
	expectCommit(implementations, atLimit, []);
	expectCommit(implementations, `${atLimit}\n\n${words(60)}`, []);
	expectCommit(implementations, `fix: short\n\n${'b'.repeat(400)}`, []);
	expect(implementations.publicCommitPrefixes).toEqual(implementations.ownerCommitPrefixes);
	for (const prefix of implementations.publicCommitPrefixes)
		expectCommit(implementations, `${prefix} say what changed`, []);
	return expectCommit(implementations, atLimit, []);
}
function commitLimitErrors(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, subject(73), ['subject has 73 characters; the limit is 72.']);
	expectCommit(implementations, `chore: short\n\n${words(61)}`, ['body has 61 words; the limit is 60.']);
	expectCommit(implementations, `chore: short\n\n${'b'.repeat(401)}`, ['body has 401 characters; the limit is 400.']);
	const trailer = 'Co-Authored-By: Someone Else <someone@example.invalid>';
	expectCommit(implementations, `chore: short\n\n${words(58)}\n\n${trailer}`, ['body has 62 words; the limit is 60.']);
	return first;
}
function commitSubjectPrefix(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, '', ['subject is empty.']);
	expectCommit(implementations, '\n\nonly a body', ['subject is empty.']);
	for (const wrong of ['add the navbar', 'Feat: add the navbar', 'feat:add the navbar', 'feat:']) {
		const actual = expectCommit(implementations, wrong, [unprefixed]);
		expect([wrong, actual]).toEqual([wrong, [unprefixed]]);
	}
	expectCommit(implementations, `docs: ${'s'.repeat(70)}`, ['subject has 76 characters; the limit is 72.', unprefixed]);
	return first;
}
function commitUnicode(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, `feat: ${'é'.repeat(65)}𝄞`, []);
	expectCommit(implementations, `feat: ${'é'.repeat(66)}𝄞`, ['subject has 73 characters; the limit is 72.']);
	const lines = Array.from({ length: 100 }, () => 'abc').join('\r\n');
	expectCommit(implementations, `fix: short\r\n\r\n${lines}`, ['body has 100 words; the limit is 60.']);
	expectCommit(implementations, `fix: short\r\n\r\n${Array.from({ length: 60 }, () => 'abcde').join('\r\n')}`, []);
	return first;
}
function commitStoredHash(implementations: CommitMessageImplementations): string[] {
	return expectCommit(implementations, `fix: short\n\n# ${'x'.repeat(700)}`, ['body has 702 characters; the limit is 400.']);
}
function commitCleaned(implementations: CommitMessageImplementations): string[] {
	const body = (letters: number) => `fix: short \n\n\n${'b'.repeat(letters)}   \n\n\n`;
	const first = expectCommit(implementations, stored(implementations, body(400)), []);
	expectCommit(implementations, stored(implementations, body(401)), ['body has 401 characters; the limit is 400.']);
	const spaced = `fix: short\n\n${words(61).replaceAll(' ', '  \n\n\n')}\n`;
	expectCommit(implementations, stored(implementations, spaced), ['body has 61 words; the limit is 60.']);
	expectCommit(implementations, stored(implementations, '\n\nadd the navbar   \n\n'), [unprefixed]);
	expectCommit(implementations, stored(implementations, '  feat: indented\n'), []);
	expectWritten(implementations, ' \n\t feat: a\n\n  b \n\u00a0\n', {}, 'feat: a\n\n  b');
	expectCommit(implementations, stored(implementations, ' \n# only a comment\n\t\n'), ['subject is empty.']);
	return first;
}
function writtenGitDrops(implementations: CommitMessageImplementations): string {
	const file = ['feat: add the navbar', '', 'Why it was needed.', '# Please enter the commit message for your changes. Lines starting', "# with '#' will be ignored, and an empty message aborts the commit.", '# ------------------------ >8 ------------------------', '# Do not modify or remove the line above.', 'diff --git a/file b/file', `+${'x'.repeat(900)}`].join('\n');
	const first = expectWritten(implementations, file, {}, 'feat: add the navbar\n\nWhy it was needed.');
	expectCommit(implementations, first, []);
	expectWritten(implementations, 'fix: a\n\n# kept\n; dropped', { comment: ';' }, 'fix: a\n\n# kept');
	for (const cleanup of ['whitespace', 'verbatim']) expectWritten(implementations, 'fix: a\n\n# kept', { cleanup }, 'fix: a\n\n# kept');
	const tail = file.split('\n').slice(5).join('\n');
	return expectWritten(implementations, `fix: a\n\n# kept\n${tail}`, { cleanup: 'scissors' }, 'fix: a\n\n# kept');
}
function writtenCleanup(implementations: CommitMessageImplementations): string {
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	for (const cleanup of cleaned) {
		const actual = expectWritten(implementations, padded, { cleanup }, 'feat: parity\n\nalpha\nbeta');
		const problems = expectCommit(implementations, actual, []);
		expect([cleanup, actual, problems]).toEqual([cleanup, 'feat: parity\n\nalpha\nbeta', []]);
	}
	const untidy = '\n \n\t\nfeat: tidy \t\r\n\n\n  \n  indented stays \n\n\n\nlast\r\n\n \n';
	for (const cleanup of cleaned) {
		const actual = expectWritten(implementations, untidy, { cleanup }, 'feat: tidy\n\n  indented stays\n\nlast');
		expect([cleanup, actual]).toEqual([cleanup, 'feat: tidy\n\n  indented stays\n\nlast']);
	}
	expectWritten(implementations, 'fix: a \n# gone\nb\n\n# gone\n\nc\n', {}, 'fix: a\nb\n\nc');
	const odd = 'fix: a\n\nb\u00a0\nc\f\nd\n';
	return expectWritten(implementations, odd, { cleanup: 'whitespace' }, 'fix: a\n\nb\u00a0\nc\f\nd');
}
function writtenVerbatim(implementations: CommitMessageImplementations) {
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	const actual = expectWritten(implementations, padded, { cleanup: 'verbatim' }, padded.trim());
	expectCommit(implementations, actual, ['body has 420 characters; the limit is 400.']);
	expectWritten(implementations, 'fix: a\n\n\n# kept  \n\n\nb', { cleanup: 'verbatim' }, 'fix: a\n\n\n# kept  \n\n\nb');
	return messageProjection(actual);
}
function writtenScissors(implementations: CommitMessageImplementations): string {
	const first = `fix: a\n\nwhy  \n${cut}\n${diff}`;
	for (const cleanup of cleaned) {
		const actual = expectWritten(implementations, first, { cleanup }, 'fix: a\n\nwhy');
		expect([cleanup, actual]).toEqual([cleanup, 'fix: a\n\nwhy']);
	}
	expectWritten(implementations, `${cut}\n${diff}`, { cleanup: 'scissors' }, '');
	const near = `fix: a\n\n${cut} more\nkept  \n`;
	expectWritten(implementations, near, {}, 'fix: a\n\nkept');
	expectWritten(implementations, near, { cleanup: 'scissors' }, `fix: a\n\n${cut} more\nkept`);
	const other = `fix: a\n\n; gone\n# kept\n;${cut.slice(1)}\n${diff}`;
	expectWritten(implementations, other, { comment: ';' }, 'fix: a\n\n# kept');
	expectWritten(implementations, `fix: a\n\n${cut}\nkept\n`, { comment: ';' }, `fix: a\n\n${cut}\nkept`);
	return 'fix: a\n\nwhy';
}
function writtenLongSpaces(implementations: CommitMessageImplementations, fixture: CommitMessageFixture) {
	const spaces = fixture.spaces ?? 200_000;
	expect(spaces).toBe(200_000);
	const run = ' '.repeat(spaces);
	const started = performance.now();
	const actual = implementations.publicWrittenMessage(`fix: a\n\nb${run}c${run}\n`, { cleanup: 'whitespace' });
	expect(actual).toBe(`fix: a\n\nb${run}c`);
	expect(implementations.ownerWrittenMessage(`fix: a\n\nb${run}c${run}\n`, { cleanup: 'whitespace' })).toBe(actual);
	expect(performance.now() - started).toBeLessThan(2_000);
	return messageProjection(actual);
}
function messageProjection(message: string) {
	return { length: message.length, start: message.slice(0, 9), end: message.slice(-1) };
}
export type { CommitMessageExampleCallbacks, CommitMessageImplementations } from './commitMessageExamples.types';
