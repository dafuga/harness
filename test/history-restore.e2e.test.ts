import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { attach, evidenceRef } from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

test('attached records are restored from Git when the local cache is gone', async () => {
	const repo = await cloneRepo(baseline);
	const { record, directory } = await repo.verify();
	await attach(repo);
	const image = record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.find((capture) => capture.kind === 'screenshot');
	const bytes = await readFile(join(directory, image?.path ?? ''));
	await rm(join(repo.root, '.cache/harness/verifications'), { recursive: true, force: true });
	const check = JSON.parse((await repo.run(['verify', 'check', '--json'])).stdout) as {
		status: string;
		record: string;
	};
	expect(check).toMatchObject({ status: 'passed', record: record.id });
	expect((await readFile(join(directory, image?.path ?? ''))).equals(bytes)).toBe(true);

	await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: nothing changed']);
	await rm(join(repo.root, '.cache/harness/verifications'), { recursive: true, force: true });
	const child = await repo.verify();
	expect([child.exitCode, child.record.failures]).toEqual([0, []]);
	expect(child.record.source).toMatchObject({ base: record.source.commit, baseRecord: record.id });
	expect(child.record.scenarios.map((scenario) => scenario.status)).toEqual(
		child.record.scenarios.map(() => 'referenced')
	);
	await repo.dispose();
}, 180_000);

test('a record belongs to one commit, and an evidence revision is never verified as source', async () => {
	const repo = await cloneRepo(baseline);
	const { record } = await repo.verify();
	const elsewhere = await repo.run([
		'history',
		'attach',
		'--commit',
		'HEAD~1',
		'--record',
		record.id
	]);
	expect(elsewhere.exitCode).toBe(1);
	expect(elsewhere.stderr).toContain('cannot be attached: record is for commit');
	await attach(repo);
	const asSource = await repo.run(['verify', 'run', '--commit', 'harness-evidence', '--json']);
	expect(asSource.exitCode).toBe(1);
	expect(asSource.stderr).toContain('is an evidence revision, not source');
	expect(
		existsSync(
			join(repo.root, '.cache/harness/verifications', await repo.git(['rev-parse', evidenceRef]))
		)
	).toBe(false);
	await repo.dispose();
}, 120_000);
