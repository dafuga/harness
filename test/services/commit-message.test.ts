import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { evidenceMarker } from '../../src/core/historyTypes';
import { CommitMessageService } from '../../src/services/commit-message-service/CommitMessageService';

let root: string;
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const git = (...args: string[]) =>
	execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], { cwd: root })
		.toString()
		.trim();
const long = `feat: ${'s'.repeat(67)}`;
/** Commits everything with a message and returns the commit. */
function commit(message: string): string {
	git('add', '-A');
	git('commit', '-q', '--allow-empty', '--cleanup=verbatim', '-m', message);
	return git('rev-parse', 'HEAD');
}

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'harness-commit-message-'));
	git('init', '-q', '-b', 'main');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('stored messages are measured from the commit that declares the limits on, each by its name', async () => {
	const service = new CommitMessageService(root);
	const before = commit(`an old subject without a prefix ${'x'.repeat(80)}`);
	writeFileSync(
		join(root, 'harness.verify.json'),
		JSON.stringify({ schemaVersion: 1, writing: 1 })
	);
	const adopted = commit('chore: adopt the writing limits');
	const tooLong = commit(long);
	const hashed = commit(`fix: short\n\n# ${'x'.repeat(700)}`);
	// What was written before the limits were declared stays valid, with or without a base.
	expect(await service.stored(null, adopted)).toEqual([]);
	expect(await service.stored(before, adopted)).toEqual([]);
	expect(await service.stored(adopted, hashed)).toEqual([
		`commit ${tooLong.slice(0, 12)}: subject has 73 characters; the limit is 72.`,
		`commit ${hashed.slice(0, 12)}: body has 702 characters; the limit is 400.`
	]);
	// Only the commits after the base are measured, and a base that is the head leaves none.
	expect(await service.stored(tooLong, hashed)).toHaveLength(1);
	expect(await service.stored(hashed, hashed)).toEqual([]);
});

test('every new commit a merge brings in is measured, not only the line of first parents', async () => {
	const service = new CommitMessageService(root);
	const base = git('rev-parse', 'HEAD');
	git('checkout', '-q', '-b', 'side');
	const hidden = commit(`fix: ${'s'.repeat(80)}`);
	git('checkout', '-q', 'main');
	const kept = commit('chore: keep going on main');
	git('merge', '-q', '--no-ff', '-m', 'chore: merge the side branch', 'side');
	const merged = git('rev-parse', 'HEAD');
	expect(await service.stored(kept, merged)).toEqual([
		`commit ${hidden.slice(0, 12)}: subject has 85 characters; the limit is 72.`
	]);
	// The same commit is found from the base both lines share.
	expect(await service.stored(base, merged)).toContain(
		`commit ${hidden.slice(0, 12)}: subject has 85 characters; the limit is 72.`
	);
	git('reset', '-q', '--hard', base);
});

test('a commit of evidence is not a message about source, and a tree without limits is not held', async () => {
	const service = new CommitMessageService(root);
	const head = git('rev-parse', 'HEAD');
	writeFileSync(join(root, evidenceMarker), '{}');
	const evidence = commit(`evidence ${'x'.repeat(200)}`);
	expect(await service.stored(head, evidence)).toEqual([]);
	git('rm', '-q', evidenceMarker, 'harness.verify.json');
	const free = commit(`no limits are declared here ${'x'.repeat(200)}`);
	expect(await service.stored(evidence, free)).toEqual([]);
});

test('the message of a commit in the making is read as Git will store it, against the staged limits', async () => {
	const service = new CommitMessageService(root);
	const file = join(root, '..', `message-${process.pid}.txt`);
	const template = '# Please enter the commit message for your changes.\n# On branch main\n';
	writeFileSync(file, `${long}\n\n${template}`);
	// Nothing staged declares the limits: the tree of the last test removed them.
	expect(await service.written(file, true)).toEqual([]);
	writeFileSync(
		join(root, 'harness.verify.json'),
		JSON.stringify({ schemaVersion: 1, writing: 1 })
	);
	git('add', 'harness.verify.json');
	expect(await service.written(file, true)).toEqual([
		'subject has 73 characters; the limit is 72.'
	]);
	writeFileSync(file, `chore: short\n\n${template}`);
	expect(await service.written(file, true)).toEqual([]);
	// A message that no editor was opened for is stored with its hash lines: they are counted.
	const literal = `chore: short\n\n# ${'x'.repeat(700)}`;
	writeFileSync(file, literal);
	expect(await service.written(file, false)).toEqual([
		'body has 702 characters; the limit is 400.'
	]);
	// In an editor the same lines are comments, which Git leaves out.
	expect(await service.written(file, true)).toEqual([]);
	// A repository that keeps messages as written keeps the lines that start with a hash.
	git('config', 'commit.cleanup', 'verbatim');
	writeFileSync(file, literal);
	expect(await service.written(file, true)).toEqual(['body has 702 characters; the limit is 400.']);
	rmSync(file, { force: true });
});
