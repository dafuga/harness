import { expect } from 'vitest';
import type { MessageCleanup } from '../../src/utils/git-source-history/commitMessage.types';
import type { CommitMessageImplementations } from './commitMessageExamples.types';
export const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
export const cleaned = ['strip', 'whitespace', 'scissors'];
export const cut = '# ------------------------ >8 ------------------------';
export const diff = `diff --git a/file b/file\n+${'x'.repeat(900)}\n`;
export const words = (count: number, word = 'word') =>
	Array.from({ length: count }, () => word).join(' ');
export const subject = (length: number) => `feat: ${'s'.repeat(length - 6)}`;
export function expectCommit(
	implementations: CommitMessageImplementations,
	message: string,
	expected: string[]
): string[] {
	const actual = implementations.publicCommitMessage(message);
	expect(actual).toEqual(expected);
	expect(implementations.ownerCommitMessage(message)).toEqual(expected);
	return actual;
}
export function expectWritten(
	implementations: CommitMessageImplementations,
	file: string,
	options: MessageCleanup,
	expected: string
): string {
	const actual = implementations.publicWrittenMessage(file, options);
	expect(actual).toBe(expected);
	expect(implementations.ownerWrittenMessage(file, options)).toBe(expected);
	return actual;
}
export function stored(
	implementations: CommitMessageImplementations,
	file: string,
	options: MessageCleanup = {}
): string {
	const actual = implementations.publicWrittenMessage(file, options);
	expect(implementations.ownerWrittenMessage(file, options)).toBe(actual);
	return actual;
}
export function messageProjection(message: string) {
	return { length: message.length, start: message.slice(0, 9), end: message.slice(-1) };
}
