import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let changed: VerifyRepo;
const started: number[] = [];
const pidFile = join(tmpdir(), `harness-daemon-${process.pid}.pid`);
function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

beforeAll(async () => {
	changed = await baselineRepo();
	await changed.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
}, 120_000);
// Whatever the verifier did, nothing this test started stays behind.
afterEach(async () => {
	for (const pid of started.splice(0)) if (alive(pid)) process.kill(pid, 'SIGKILL');
	await rm(pidFile, { force: true });
});
afterAll(() => changed.dispose());

test('a check that leaves a daemon running cannot pass, and the daemon is stopped', async () => {
	const repo = await cloneRepo(changed);
	// The check captures everything it should and exits 0; only its descendant is wrong.
	const outcome = await repo.verify([], { FIXTURE_DAEMON: pidFile });
	const pid = Number(await readFile(pidFile, 'utf8'));
	started.push(pid);
	expect([outcome.exitCode, outcome.record.status]).toEqual([1, 'failed']);
	expect(outcome.record.failures).toEqual([
		'titles-page: test page left 1 process running after it ended; it was stopped'
	]);
	const page = outcome.record.tests.find((test) => test.id === 'titles-page:page');
	expect(page?.status).toBe('failed');
	expect(alive(pid)).toBe(false);

	// The same check without the daemon passes: the failure is the descendant and nothing else.
	const clean = await repo.verify();
	expect([clean.exitCode, clean.record.status, clean.record.failures]).toEqual([0, 'passed', []]);
	await repo.dispose();
}, 180_000);
