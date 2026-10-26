import { expect } from 'vitest';
import type { CommitMessageImplementations } from './commitMessageExamples.types';
import {
	expectCommit,
	expectWritten,
	stored,
	words,
	subject,
	unprefixed
} from './commitMessageAssertions';
export function commitLimits(implementations: CommitMessageImplementations): string[] {
	const atLimit = subject(72);
	expectCommit(implementations, atLimit, []);
	expectCommit(implementations, `${atLimit}\n\n${words(60)}`, []);
	expectCommit(implementations, `fix: short\n\n${'b'.repeat(400)}`, []);
	expect(implementations.publicCommitPrefixes).toEqual(implementations.ownerCommitPrefixes);
	for (const prefix of implementations.publicCommitPrefixes)
		expectCommit(implementations, `${prefix} say what changed`, []);
	return expectCommit(implementations, atLimit, []);
}
export function commitLimitErrors(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, subject(73), [
		'subject has 73 characters; the limit is 72.'
	]);
	expectCommit(implementations, `chore: short\n\n${words(61)}`, [
		'body has 61 words; the limit is 60.'
	]);
	expectCommit(implementations, `chore: short\n\n${'b'.repeat(401)}`, [
		'body has 401 characters; the limit is 400.'
	]);
	const trailer = 'Co-Authored-By: Someone Else <someone@example.invalid>';
	expectCommit(implementations, `chore: short\n\n${words(58)}\n\n${trailer}`, [
		'body has 62 words; the limit is 60.'
	]);
	return first;
}
export function commitSubjectPrefix(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, '', ['subject is empty.']);
	expectCommit(implementations, '\n\nonly a body', ['subject is empty.']);
	for (const wrong of ['add the navbar', 'Feat: add the navbar', 'feat:add the navbar', 'feat:']) {
		const actual = expectCommit(implementations, wrong, [unprefixed]);
		expect([wrong, actual]).toEqual([wrong, [unprefixed]]);
	}
	expectCommit(implementations, `docs: ${'s'.repeat(70)}`, [
		'subject has 76 characters; the limit is 72.',
		unprefixed
	]);
	return first;
}
export function commitUnicode(implementations: CommitMessageImplementations): string[] {
	const first = expectCommit(implementations, `feat: ${'é'.repeat(65)}𝄞`, []);
	expectCommit(implementations, `feat: ${'é'.repeat(66)}𝄞`, [
		'subject has 73 characters; the limit is 72.'
	]);
	const lines = Array.from({ length: 100 }, () => 'abc').join('\r\n');
	expectCommit(implementations, `fix: short\r\n\r\n${lines}`, [
		'body has 100 words; the limit is 60.'
	]);
	expectCommit(
		implementations,
		`fix: short\r\n\r\n${Array.from({ length: 60 }, () => 'abcde').join('\r\n')}`,
		[]
	);
	return first;
}
export function commitStoredHash(implementations: CommitMessageImplementations): string[] {
	return expectCommit(implementations, `fix: short\n\n# ${'x'.repeat(700)}`, [
		'body has 702 characters; the limit is 400.'
	]);
}
export function commitCleaned(implementations: CommitMessageImplementations): string[] {
	const body = (letters: number) => `fix: short \n\n\n${'b'.repeat(letters)}   \n\n\n`;
	const first = expectCommit(implementations, stored(implementations, body(400)), []);
	expectCommit(implementations, stored(implementations, body(401)), [
		'body has 401 characters; the limit is 400.'
	]);
	const spaced = `fix: short\n\n${words(61).replaceAll(' ', '  \n\n\n')}\n`;
	expectCommit(implementations, stored(implementations, spaced), [
		'body has 61 words; the limit is 60.'
	]);
	expectCommit(implementations, stored(implementations, '\n\nadd the navbar   \n\n'), [unprefixed]);
	expectCommit(implementations, stored(implementations, '  feat: indented\n'), []);
	expectWritten(implementations, ' \n\t feat: a\n\n  b \n\u00a0\n', {}, 'feat: a\n\n  b');
	expectCommit(implementations, stored(implementations, ' \n# only a comment\n\t\n'), [
		'subject is empty.'
	]);
	return first;
}
