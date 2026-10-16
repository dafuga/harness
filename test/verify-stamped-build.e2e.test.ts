import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { VerificationRecordValidator } from '../src/validators/VerificationRecordValidator';
import { runCommand } from './support/cli';
import { attach, evidenceRef, statusOf } from './support/historyRepo';
import { servedRepo } from './support/servedRepo';
import { cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

interface Verified {
	repo: VerifyRepo;
	outcome: VerifyOutcome;
}
interface Declared {
	setup: object[];
	outputs: string[];
	builds: object[];
}
let baseline: VerifyRepo;
let stamped: Verified;
const cli = resolve('src/index.ts');
const hash = /^[0-9a-f]{64}$/;
const site = { id: 'site', directory: 'build', buildId: expect.stringMatching(hash), files: 2 };
const worker = { id: 'worker', directory: 'out', buildId: expect.stringMatching(hash), files: 2 };
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
/** A change that outgrows the budgets of its unit, so only the budget gate fails. */
const grow = (source: string) =>
	source.replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);
/**
 * Shell that compiles a Worker into a directory: a server that cannot read its own files, so
 * it carries a slot for its identity. The slot is put together by printf, not written here.
 */
const compile = (directory: string): string =>
	[
		`mkdir -p ${directory}/assets`,
		`printf 'export const build = "harness-build:%064d";\\n' 0 > ${directory}/_worker.js`,
		`printf 'render("first");\\n' > ${directory}/assets/app.js`
	].join(' && ');
const recompile = `printf 'render("second");\\n' > out/assets/app.js`;

/**
 * A commit whose setup also compiles the Worker, stamps it, and then runs `later`, verified
 * after `edit` changed and explained one unit.
 */
async function verified(later: string[] = [], edit = upper): Promise<Verified> {
	const repo = await cloneRepo(baseline);
	const config = await repo.json<Declared>('harness.verify.json');
	const steps = [compile('out'), `bun ${cli} verify stamp out`, ...later];
	await repo.write(
		'harness.verify.json',
		JSON.stringify({
			...config,
			setup: [...config.setup, ...steps.map((command) => ({ command }))],
			outputs: [...config.outputs, 'out/'],
			builds: [...config.builds, { id: 'worker', directory: 'out' }]
		})
	);
	await repo.commit('chore: compile and stamp a Worker');
	await repo.change('src/utils/slugify.ts', edit);
	return { repo, outcome: await repo.verify() };
}
/** The record as it lies in the store, judged as every command that loads it judges it. */
async function stored(outcome: VerifyOutcome) {
	const text = await readFile(join(outcome.directory, 'record.json'), 'utf8');
	return new VerificationRecordValidator().validate(JSON.parse(text));
}

beforeAll(async () => {
	baseline = await servedRepo();
	stamped = await verified();
}, 360_000);
afterAll(async () => {
	await stamped?.repo.dispose();
	await baseline?.dispose();
});

test('a build that setup stamped passes, and the record names where it is and what its files are', () => {
	const { record, exitCode } = stamped.outcome;
	expect([exitCode, record.status, record.failures]).toEqual([0, 'passed', []]);
	expect(record.builds).toEqual([site, worker]);
});

test('the stored record of a stamped build is a valid record', async () => {
	const judged = await stored(stamped.outcome);
	expect(judged.errors).toEqual([]);
	expect(judged.value?.id).toBe(stamped.outcome.record.id);
});

test('the store loads it: the commit of a stamped build is proven by its record', async () => {
	const check = await stamped.repo.run(['verify', 'check', '--json']);
	expect([check.exitCode, check.stderr]).toEqual([0, '']);
});

test('the record of a stamped build is attached to history and found intact there', async () => {
	const { repo, outcome } = stamped;
	const attached = await attach(repo);
	expect(attached).toMatchObject({ record: outcome.record.id, status: 'passed', created: true });
	const kept = await repo.git(['show', `${evidenceRef}:${attached.evidence.path}/record.json`]);
	expect(new VerificationRecordValidator().validate(JSON.parse(kept)).errors).toEqual([]);
	const status = await statusOf(repo);
	expect(status).toMatchObject({ verified: true, problems: [] });
	const { evidence } = attached;
	expect(status.records).toEqual([
		{ record: outcome.record.id, status: 'passed', valid: true, problems: [], evidence }
	]);
}, 120_000);

test('the same files, stamped outside a verification, carry the recorded identity as their stamp', async () => {
	const { repo, outcome } = stamped;
	const built = (outcome.record.builds ?? []).find((build) => build.id === 'worker');
	if (!built) throw new Error('the run recorded no worker build');
	const outside = join(repo.root, '..', 'outside');
	await runCommand(['sh', '-c', compile(outside)], repo.root);
	const written = await repo.run(['verify', 'stamp', outside, '--json']);
	expect(JSON.parse(written.stdout)).toMatchObject({
		buildId: built.buildId,
		stamp: built.buildId
	});
	const read = await repo.run(['verify', 'identity', outside, '--json']);
	expect(JSON.parse(read.stdout)).toMatchObject({ files: 2, stamp: built.buildId });
	expect(await readFile(join(outside, '_worker.js'), 'utf8')).toContain(built.buildId);
}, 60_000);

test('a build changed after it was stamped is refused; nothing of it is recorded or proven', async () => {
	const { repo, outcome } = await verified([recompile]);
	expect([outcome.exitCode, outcome.record.status]).toEqual([1, 'failed']);
	expect(outcome.record.failures).toEqual([
		expect.stringMatching(/^build worker carries the stamp of other files \([0-9a-f]{12}\)/)
	]);
	expect(outcome.record.builds).toEqual([site]);
	expect((await stored(outcome)).errors).toEqual([]);
	expect((await repo.run(['verify', 'check', '--json'])).exitCode).toBe(1);
	await repo.dispose();
}, 240_000);

test('a stamped build that fails only its budgets is a failed record: it loads and attaches as failed', async () => {
	const { repo, outcome } = await verified([], grow);
	const { record } = outcome;
	expect([outcome.exitCode, record.status]).toEqual([1, 'failed']);
	expect(record.gates).toMatchObject({
		snapshot: 'passed',
		tests: 'passed',
		scenarios: 'passed',
		reasons: 'passed',
		budgets: 'failed'
	});
	expect(record.builds).toEqual([site, worker]);
	expect((await stored(outcome)).errors).toEqual([]);
	const check = await repo.run(['verify', 'check', '--json']);
	expect(check.exitCode).toBe(1);
	expect(check.stdout + check.stderr).not.toContain('No verification record exists');
	expect(check.stdout + check.stderr).toContain(record.id);
	const attached = await attach(repo);
	expect(attached).toMatchObject({ record: record.id, status: 'failed', created: true });
	const status = await statusOf(repo);
	expect([
		status.verified,
		status.records.map((item) => [item.record, item.status, item.valid])
	]).toEqual([false, [[record.id, 'failed', true]]]);
	await repo.dispose();
}, 240_000);
