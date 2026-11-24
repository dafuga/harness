import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { isRevision, releaseRevision } from '../scripts/release-revision';

let directory: string;

const git = (...args: string[]) =>
	execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), 'harness-release-revision-'));
	git('init', '--quiet');
	git('config', 'user.email', 'release@example.invalid');
	git('config', 'user.name', 'Release Test');
	writeFileSync(join(directory, 'tracked.txt'), 'one\n');
	git('add', 'tracked.txt');
	git('commit', '--quiet', '-m', 'initial');
});

afterEach(() => {
	rmSync(directory, { recursive: true, force: true });
});

test('a clean tree releases the exact full commit', () => {
	expect(releaseRevision(directory)).toBe(git('rev-parse', 'HEAD'));
	expect(isRevision(releaseRevision(directory))).toBe(true);
});

test('an untracked file does not change the released revision', () => {
	writeFileSync(join(directory, 'scratch.txt'), 'untracked\n');
	expect(releaseRevision(directory)).toBe(git('rev-parse', 'HEAD'));
});

test('a modified tracked file refuses the release', () => {
	writeFileSync(join(directory, 'tracked.txt'), 'two\n');
	expect(() => releaseRevision(directory)).toThrow('clean tracked worktree');
});

test('a directory outside git refuses the release', () => {
	const outside = mkdtempSync(join(tmpdir(), 'harness-no-git-'));
	try {
		expect(() => releaseRevision(outside)).toThrow('needs a git commit');
	} finally {
		rmSync(outside, { recursive: true, force: true });
	}
});

test.each([
	['a short hash', 'abc1234'],
	['an uppercase hash', 'A'.repeat(40)],
	['a missing value', undefined]
])('%s is not a release revision', (_label, value) => {
	expect(isRevision(value)).toBe(false);
});
