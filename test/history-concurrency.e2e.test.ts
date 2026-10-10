import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	attach,
	evidenceRef,
	noteLines,
	sha256,
	statusOf,
	type Attached
} from './support/historyRepo';
import {
	baselineRepo,
	cloneRepo,
	repoAt,
	type VerifyOutcome,
	type VerifyRepo
} from './support/verifyRepo';

let baseline: VerifyRepo;
let runs: VerifyOutcome[];
beforeAll(async () => {
	baseline = await baselineRepo();
	runs = [];
	for (let run = 0; run < 4; run += 1) runs.push(await baseline.verify());
}, 240_000);
afterAll(() => baseline.dispose());

const media = (outcome: VerifyOutcome) =>
	outcome.record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.kind === 'screenshot' || capture.kind === 'audio');

/** Attaches every record at once and returns each command's exit code, output and error. */
function together(repos: VerifyRepo[], records: string[]) {
	return Promise.all(
		records.map((record, index) =>
			repos[index % repos.length].run(['history', 'attach', '--record', record, '--json'])
		)
	);
}

/** Both records, their notes and every file must be in Git, and the source must be untouched. */
async function expectBoth(repo: VerifyRepo, outcomes: VerifyOutcome[], lfsRoot = repo.root) {
	const ids = outcomes.map((outcome) => outcome.record.id).sort();
	const status = await statusOf(repo);
	expect(status.records.map((item) => item.record).sort()).toEqual(ids);
	expect(status.records.map((item) => [item.status, item.valid, item.problems])).toEqual(
		ids.map(() => ['passed', true, []])
	);
	expect(status.verified).toBe(true);
	const lines = (await noteLines(repo)).filter((line) => line.kind === 'verification');
	expect(lines.map((line) => line.record).sort()).toEqual(ids);
	const tip = await repo.git(['rev-parse', evidenceRef]);
	const listed = await repo.git(['ls-tree', '-r', '--name-only', tip]);
	for (const line of lines) {
		await repo.git(['merge-base', '--is-ancestor', line.evidence?.commit ?? '', tip]);
		expect(listed).toContain(`${line.evidence?.path}/record.json`);
		expect(listed).toContain(`${line.evidence?.path}/manifest.json`);
	}
	for (const capture of outcomes.flatMap(media)) {
		const object = join(
			lfsRoot,
			'.git/lfs/objects',
			capture.sha256.slice(0, 2),
			capture.sha256.slice(2, 4),
			capture.sha256
		);
		expect(sha256(await readFile(object))).toBe(capture.sha256);
	}
}

test('the prepared records are distinct runs of one commit with byte-identical media', () => {
	expect(new Set(runs.map((run) => run.record.id)).size).toBe(4);
	expect(runs.map((run) => run.record.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
	const hashes = runs.map((run) =>
		media(run)
			.map((capture) => capture.sha256)
			.sort()
	);
	expect(hashes[0].length).toBeGreaterThan(0);
	expect(hashes[1]).toEqual(hashes[0]);
});

test('two records with identical media attach at the same time in one repository', async () => {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const repo = await cloneRepo(baseline);
		const before = await repo.git(['rev-parse', 'HEAD', 'HEAD^{tree}']);
		const pair = runs.slice(0, 2);
		const results = await together(
			[repo],
			pair.map((run) => run.record.id)
		);
		expect(results.map((result) => [result.exitCode, result.stderr])).toEqual([
			[0, ''],
			[0, '']
		]);
		const attached = results.map((result) => JSON.parse(result.stdout) as Attached);
		expect(attached.map((item) => item.created)).toEqual([true, true]);
		await expectBoth(repo, pair);
		expect(await repo.git(['rev-parse', 'HEAD', 'HEAD^{tree}'])).toBe(before);
		expect(await repo.git(['status', '--porcelain'])).toBe('');
		await repo.dispose();
	}
}, 300_000);

test('four writers at once lose nothing', async () => {
	const repo = await cloneRepo(baseline);
	const results = await together(
		[repo],
		runs.map((run) => run.record.id)
	);
	expect(results.map((result) => result.exitCode)).toEqual([0, 0, 0, 0]);
	await expectBoth(repo, runs);
	const again = await together(
		[repo],
		runs.map((run) => run.record.id)
	);
	expect(again.map((result) => (JSON.parse(result.stdout) as Attached).created)).toEqual([
		false,
		false,
		false,
		false
	]);
	await expectBoth(repo, runs);
	await repo.dispose();
}, 300_000);

test('two worktrees that share one Git directory attach at the same time', async () => {
	const repo = await cloneRepo(baseline);
	const secondRoot = join(repo.root, '..', 'second');
	await repo.git(['worktree', 'add', '-q', '-b', 'second', secondRoot]);
	const second = repoAt(secondRoot);
	expect(statSync(join(second.root, '.git')).isFile()).toBe(true);
	const head = await repo.git(['rev-parse', 'HEAD', 'HEAD^{tree}']);
	// The second worktree has no scratch cache. What it needs to verify, the record the budget
	// ledger cites and the reasons recorded with it, reaches it through Git once attached.
	await attach(repo, ['--commit', 'HEAD~1']);
	const [mine, theirs] = [await repo.verify(), await second.verify()];
	expect([mine.record.status, theirs.record.status]).toEqual(['passed', 'passed']);
	expect(mine.record.source.commit).toBe(theirs.record.source.commit);

	const results = await Promise.all([
		repo.run(['history', 'attach', '--record', mine.record.id, '--json']),
		second.run(['history', 'attach', '--record', theirs.record.id, '--json'])
	]);
	expect(results.map((result) => [result.exitCode, result.stderr])).toEqual([
		[0, ''],
		[0, '']
	]);
	for (const worktree of [repo, second]) {
		await expectBoth(worktree, [mine, theirs], repo.root);
		expect(await worktree.git(['rev-parse', 'HEAD', 'HEAD^{tree}'])).toBe(head);
		expect(await worktree.git(['status', '--porcelain'])).toBe('');
	}
	const check = JSON.parse((await second.run(['verify', 'check', '--json'])).stdout);
	expect(check.status).toBe('passed');
	await repo.dispose();
}, 300_000);
