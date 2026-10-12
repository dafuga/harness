import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { legacyPrePush } from './support/legacyHooks';
import { sharedHooks, type SharedHooks, type SharedStatus } from './support/sharedHooks';

// One hooks directory serves every worktree of a repository. A stage Harness offers later is
// written into it for all of them, and may act only where that stage was asked for.
const long = `add the navbar ${'s'.repeat(80)}`;
const refusal = 'subject does not start with feat:, fix:, chore: or cleanup:.';
const unsupported = 'Unsupported hook stage';
const enabled = (status: SharedStatus) => status.stages.map((item) => [item.stage, item.enabled]);
const push = ['hooks run pre-push'];

let shared: SharedHooks;
afterEach(() => shared?.dispose());

test('a worktree that opted into pushes under an earlier Harness is not handed commit-msg', async () => {
	shared = await sharedHooks();
	const { legacy, current, plain } = shared;
	await shared.optInEarlier(legacy);
	// As it was: the earlier worktree commits what it likes, and its Harness is not asked.
	expect((await legacy.commit(long)).exitCode).toBe(0);
	await shared.install(current);
	// The shared hook started in the earlier worktree on a message file, with no commit made.
	const file = join(shared.parent, 'message.txt');
	await writeFile(file, 'feat: short message\n');
	const direct = await legacy.run(['sh', join(shared.hooks, 'commit-msg'), file]);
	expect([direct.exitCode, direct.stderr]).toEqual([0, '']);
	const before = await legacy.head();
	const made = await legacy.commit(long);
	expect([made.exitCode, made.stderr.includes(unsupported)]).toEqual([0, false]);
	expect(await legacy.head()).not.toBe(before);
	// Its Harness is started for the push it asked for, once, and for nothing else.
	expect((await legacy.push()).exitCode).toBe(0);
	expect(await shared.started('legacy')).toEqual(push);
	// A worktree that never opted in starts no Harness at all, for a commit or for a push.
	expect((await plain.commit(long)).exitCode).toBe(0);
	expect((await plain.push()).exitCode).toBe(0);
	expect([await shared.started('legacy'), await shared.started('current')]).toEqual([push, []]);
	// Where the stage was asked for, a message is still measured before the commit exists.
	const tip = await current.head();
	const stopped = await current.commit(long);
	expect([stopped.exitCode !== 0, stopped.stderr.includes(refusal)]).toEqual([true, true]);
	expect(await current.head()).toBe(tip);
	expect((await current.commit('feat: short')).exitCode).toBe(0);
	expect(await shared.started('current')).toEqual(Array(2).fill('hooks run commit-msg'));
	// The hooks the project had ran first every time, in whichever worktree Git started them.
	expect(await shared.existing()).toEqual([
		...Array<string>(3).fill('commit-msg legacy'),
		'pre-push legacy',
		'commit-msg plain',
		'pre-push plain',
		...Array<string>(2).fill('commit-msg current')
	]);
}, 120_000);

test('each worktree is told its own stages, and leaving restores what was there byte for byte', async () => {
	shared = await sharedHooks();
	const { legacy, current, plain } = shared;
	const config = () => readFile(join(shared.parent, 'main/.git/config'), 'utf8');
	const [untouched, configured] = [await shared.snapshot(), await config()];
	await shared.optInEarlier(legacy);
	const earlier = await shared.snapshot();
	const installed = await shared.install(current);
	expect(installed.stages).toEqual([
		{ stage: 'pre-push', installed: true, chained: true, enabled: true },
		{ stage: 'commit-msg', installed: true, chained: true, enabled: true }
	]);
	// The earlier opt-in is what it was: its one file with its own command, and its one stage.
	const optIn = join(legacy.gitDir, 'harness-hooks');
	expect(await readFile(optIn, 'utf8')).toBe(`${shared.legacyCommand}\n`);
	expect(await legacy.optIns()).toEqual(['harness-hooks']);
	expect(await readFile(join(shared.hooks, 'pre-push'), 'utf8')).toBe(legacyPrePush);
	expect(enabled(await legacy.harness('status'))).toEqual([
		['pre-push', true],
		['commit-msg', false]
	]);
	expect(enabled(await plain.harness('status'))).toEqual([
		['pre-push', false],
		['commit-msg', false]
	]);
	expect(await plain.optIns()).toEqual([]);
	// The newer worktree leaves: the stage only it used goes, the push hook of the other stays.
	await current.harness('uninstall');
	expect([await shared.snapshot(), await current.optIns()]).toEqual([earlier, []]);
	expect((await legacy.commit(long)).exitCode).toBe(0);
	expect((await legacy.push()).exitCode).toBe(0);
	expect(await shared.started('legacy')).toEqual(push);
	// The last opt-in leaves: the directory and the configuration are what they were before.
	await legacy.harness('uninstall');
	expect([await shared.snapshot(), await config()]).toEqual([untouched, configured]);
	expect([await legacy.optIns(), await shared.started('current')]).toEqual([[], []]);
}, 120_000);

test('installing again replaces the first commit-msg wrapper, which asked the push opt-in', async () => {
	shared = await sharedHooks();
	const { legacy, current } = shared;
	const untouched = await shared.snapshot();
	await shared.optInEarlier(legacy);
	await shared.optInFirstRelease(current);
	// What went wrong: that wrapper starts the earlier Harness, which refuses the stage.
	const refused = await legacy.commit(long);
	expect([refused.exitCode !== 0, refused.stderr.includes(unsupported)]).toEqual([true, true]);
	// A worktree left with that release's one file has not asked for the stage by today's rule.
	await shared.install(current);
	expect(await current.optIns()).toEqual(['harness-hooks', 'harness-hooks-commit-msg']);
	expect((await legacy.commit(long)).exitCode).toBe(0);
	expect((await current.commit(long)).stderr).toContain(refusal);
	// The earlier Harness ends its opt-in its own way: its file goes, the wrappers stay in use.
	await rm(join(legacy.gitDir, 'harness-hooks'));
	expect((await legacy.commit(long)).exitCode).toBe(0);
	expect((await current.commit(long)).stderr).toContain(refusal);
	await current.harness('uninstall');
	expect(await shared.snapshot()).toEqual(untouched);
	expect(await shared.started('legacy')).toEqual(['hooks run commit-msg']);
}, 120_000);
