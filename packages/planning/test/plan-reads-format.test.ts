import { expect } from '../../../test/verificationExpect';
import { afterEach, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
import { planGit } from '../src/lib/planning/planGit';
import { type Git } from '../src/utils/planGit';
import { planReads } from '../src/services/planning-service/planReads';

/**
 * Real SHA-1 and SHA-256 repositories. A name is answered again within one operation only when
 * it is a full id of the repository's own object format: a branch named like an id of the other
 * width moves, and a Git that states no format reads every name again.
 */
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
type Case = { name: string; input: unknown; output: unknown };
async function repository(format: 'sha1' | 'sha256') {
	const root = await mkdtemp(join(tmpdir(), `planning-${format}-`));
	roots.push(root);
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	git('init', '-q', `--object-format=${format}`, '-b', 'main');
	git('config', 'user.name', 'Fixture');
	git('config', 'user.email', 'fixture@example.invalid');
	git('commit', '-q', '--allow-empty', '-m', 'first');
	const first = git('rev-parse', 'HEAD');
	git('commit', '-q', '--allow-empty', '-m', 'second');
	return { root, git, first, second: git('rev-parse', 'HEAD') };
}
function counting(base: Git) {
	const calls: string[][] = [];
	const git: Git = {
		...base,
		run: (args, input, env) => (calls.push(args), base.run(args, input, env))
	};
	return { reads: planReads(git), calls };
}
async function ask(cases: Case[], git: Git, args: string[], calls: string[][]) {
	const output = (await git.run(args)).toString().trim();
	cases.push({
		name: args.join(' '),
		input: { args },
		output: { answer: output, reachedGit: calls.length }
	});
	return output;
}
const verify = (name: string) => ['rev-parse', '--verify', `${name}^{commit}`];
/** The unit and symbol whose actual calls a trace records. */
type Producer = { unitId: string; symbol: string };
const readHandle: Producer = { unitId: 'planning.function.plan-reads', symbol: 'planReads' };
const formatProducer: Producer = { unitId: 'planning.function.plan-git', symbol: 'planGit' };
const trace = (file: string, cases: Case[], producer: Producer = readHandle) =>
	recordCapture(
		{
			evidence: 'planning-artifacts-reads',
			kind: 'trace',
			state: 'operation-read-isolation',
			file,
			mediaType: 'application/json'
		},
		JSON.stringify(
			{
				schemaVersion: 1,
				kind: 'function-invocations',
				...producer,
				cases
			},
			null,
			'\t'
		)
	);
/** A branch named like an id of the other width moves between two reads of one operation. */
async function moved(format: 'sha1' | 'sha256', branch: string, file: string) {
	const repo = await repository(format);
	repo.git('branch', branch, repo.first);
	const { reads, calls } = counting(await planGit(repo.root));
	const cases: Case[] = [];
	const before = await ask(cases, reads, verify(branch), calls);
	repo.git('update-ref', `refs/heads/${branch}`, repo.second);
	const after = await ask(cases, reads, verify(branch), calls);
	expect([before, after]).toEqual([repo.first, repo.second]);
	await ask(cases, reads, verify(repo.first), calls);
	await ask(cases, reads, verify(repo.first), calls);
	expect(calls.filter((args) => args[2] === verify(repo.first)[2])).toHaveLength(1);
	trace(file, cases);
}

test('in a SHA-1 repository a branch named like a SHA-256 id is read again after it moves', async () => {
	await moved('sha1', 'a'.repeat(64), 'plan-reads-sha1-wide-branch.json');
}, 20000);

test('in a SHA-256 repository a branch named like a SHA-1 id is read again after it moves', async () => {
	await moved('sha256', 'b'.repeat(40), 'plan-reads-sha256-narrow-branch.json');
}, 20000);

test('a Git that states no object format reads even a full id again', async () => {
	const repo = await repository('sha1');
	const unstated: Git = { ...(await planGit(repo.root)), objectFormat: undefined };
	const { reads, calls } = counting(unstated);
	const cases: Case[] = [];
	await ask(cases, reads, verify(repo.first), calls);
	await ask(cases, reads, verify(repo.first), calls);
	expect(calls).toHaveLength(2);
	trace('plan-reads-unstated-format.json', cases);
}, 20000);

test('planGit states the object format of a SHA-1 and of a SHA-256 repository', async () => {
	const cases: Case[] = [];
	for (const format of ['sha1', 'sha256'] as const) {
		const repo = await repository(format);
		const stated = (await planGit(repo.root)).objectFormat;
		cases.push({
			name: `planGit of a ${format} repository`,
			input: { format },
			output: { objectFormat: stated ?? null }
		});
	}
	expect(cases.map((item) => item.output)).toEqual([
		{ objectFormat: 'sha1' },
		{ objectFormat: 'sha256' }
	]);
	trace('plan-reads-object-formats.json', cases, formatProducer);
}, 20000);
