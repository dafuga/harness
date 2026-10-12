import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runHarness } from './support/cli';

/**
 * Who is working in a repository now is what agents say about themselves while they work: a
 * registration, heartbeats and an end. Every checkout of the repository sees the same agents,
 * another repository sees none of them, and what is not known is said instead of counted.
 */
interface Entry {
	id: string;
	label: string;
	provider: string | null;
	model: string | null;
	worktree: string;
	branch: string | null;
	task: string | null;
	loop: string | null;
	units: string[];
	unknownUnits: string[];
	state: string;
	detail: string;
	outcome?: string;
}
interface Roster {
	tracking: string;
	working: number | null;
	unreadable: number;
	roster: Entry[];
}
let scratch: string;
const at = (name: string) => join(scratch, name);
const git = (cwd: string, args: string[]) =>
	execFileSync(
		'git',
		['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid', ...args],
		{ cwd, encoding: 'utf8' }
	).trim();
function repository(name: string): string {
	mkdirSync(at(name), { recursive: true });
	git(at(name), ['init', '-q', '-b', 'main']);
	writeFileSync(join(at(name), 'README.md'), `# ${name}\n`);
	writeFileSync(join(at(name), '.gitignore'), '.cache/\n');
	git(at(name), ['add', '-A']);
	git(at(name), ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'feat: start']);
	return at(name);
}
const run = (cwd: string, args: string[], ok = true) => runHarness(['activity', ...args], cwd, ok);
const json = async <T>(cwd: string, args: string[]) =>
	JSON.parse((await run(cwd, [...args, '--json'])).stdout) as T;
const roster = (cwd: string) => json<Roster>(cwd, ['agents']);
const register = async (cwd: string, label: string, more: string[] = []) =>
	(await json<{ id: string; branch: string | null }>(cwd, ['register', '--label', label, ...more]))
		.id;
const named = (list: Roster, label: string) => list.roster.find((item) => item.label === label);

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-agents-'));
	repository('site');
	git(at('site'), ['worktree', 'add', '-q', '-b', 'feature', at('checkout')]);
	repository('foreign');
	repository('quiet');
}, 60_000);
afterAll(() => rm(scratch, { recursive: true, force: true }));

test('a repository where no agent ever registered says it does not know, not zero', async () => {
	expect(await roster(at('quiet'))).toEqual({
		tracking: 'never-used',
		working: null,
		unreadable: 0,
		roster: []
	});
});

test('an agent states who it is, and every checkout of its repository sees it; another repository does not', async () => {
	const stated = ['--provider', 'anthropic', '--model', 'claude-opus-5-5'];
	const work = ['--task', 'Project analytics', '--loop', 'project-activity'];
	const units = ['--units', 'service.title,function.slugify'];
	await register(at('checkout'), 'Opus session', [...stated, ...work, ...units]);
	await register(at('site'), 'Unnamed helper');
	await register(at('foreign'), 'Foreign agent', ['--model', 'foreign-model']);
	for (const checkout of ['site', 'checkout']) {
		const seen = await roster(at(checkout));
		expect([seen.tracking, seen.working, seen.unreadable]).toEqual(['available', 2, 0]);
		expect(named(seen, 'Opus session')).toMatchObject({
			provider: 'anthropic',
			model: 'claude-opus-5-5',
			worktree: 'checkout',
			branch: 'feature',
			task: 'Project analytics',
			loop: 'project-activity',
			units: ['function.slugify', 'service.title'],
			state: 'working'
		});
		// Nothing is made up for what an owner did not state.
		expect(named(seen, 'Unnamed helper')).toMatchObject({
			provider: null,
			model: null,
			task: null,
			loop: null,
			units: [],
			worktree: 'site',
			branch: 'main'
		});
		expect(JSON.stringify(seen)).not.toMatch(/Foreign agent|foreign-model/);
	}
	const other = await roster(at('foreign'));
	expect(other.roster.map((item) => item.label)).toEqual(['Foreign agent']);
});

test('a heartbeat keeps an agent working and may restate its work; without one it is stale and not counted', async () => {
	const id = await register(at('site'), 'Short lived', ['--ttl', '1', '--units', 'service.title']);
	await wait(1300);
	const quiet = await roster(at('site'));
	expect(named(quiet, 'Short lived')?.state).toBe('stale');
	expect(named(quiet, 'Short lived')?.detail).toMatch(/heartbeat/i);
	expect(quiet.working).toBe(quiet.roster.filter((item) => item.state === 'working').length);
	await run(at('site'), ['heartbeat', id, '--task', 'Next step', '--units', 'function.slugify']);
	const again = named(await roster(at('site')), 'Short lived');
	expect(again).toMatchObject({ state: 'working', task: 'Next step', units: ['function.slugify'] });
	const unknown = await run(at('site'), ['heartbeat', 'nobody-registered-this'], false);
	expect([unknown.exitCode, unknown.stderr]).toEqual([1, expect.stringMatching(/not registered/)]);
}, 30_000);

test('a finished or failed agent is listed as that, and a late heartbeat does not bring it back', async () => {
	const done = await register(at('checkout'), 'Finisher');
	const broke = await register(at('checkout'), 'Breaker');
	await run(at('checkout'), ['finish', done, '--outcome', 'Handed over']);
	await run(at('checkout'), ['finish', broke, '--failed', '--outcome', 'Tests stayed red']);
	const late = await run(at('checkout'), ['heartbeat', done], false);
	expect([late.exitCode, late.stderr]).toEqual([1, expect.stringMatching(/finished/)]);
	const seen = await roster(at('site'));
	expect(named(seen, 'Finisher')).toMatchObject({ state: 'completed', outcome: 'Handed over' });
	expect(named(seen, 'Breaker')).toMatchObject({ state: 'failed', outcome: 'Tests stayed red' });
	expect(seen.working).toBe(seen.roster.filter((item) => item.state === 'working').length);
});

test('an agent whose process ended is not counted, whatever its heartbeat says', async () => {
	const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
	const id = await register(at('site'), 'With a process', ['--pid', String(child.pid)]);
	expect(named(await roster(at('site')), 'With a process')?.state).toBe('working');
	const ended = new Promise((resolve) => child.once('exit', resolve));
	child.kill('SIGKILL');
	await ended;
	await run(at('site'), ['heartbeat', id]);
	const after = named(await roster(at('site')), 'With a process');
	expect(after?.state).toBe('gone');
	expect(after?.detail).toMatch(/process/);
	// A process that does not exist cannot be registered as the agent.
	const absent = await run(at('site'), ['register', '--label', 'Nobody', '--pid', '999999'], false);
	expect([absent.exitCode, absent.stderr]).toEqual([1, expect.stringMatching(/999999/)]);
});

test('many agents register, beat and finish at once without losing or damaging a registration', async () => {
	const labels = Array.from({ length: 12 }, (_, index) => `Parallel ${index + 1}`);
	const ids = await Promise.all(
		labels.map((label, index) => register(at(index % 2 ? 'site' : 'checkout'), label))
	);
	expect(new Set(ids).size).toBe(12);
	// Heartbeats and ends of the same agents arrive together; an end always wins.
	const racing = ids.flatMap((id, index) => [
		run(at('site'), ['heartbeat', id], false),
		...(index < 4 ? [run(at('checkout'), ['finish', id, '--outcome', 'Raced'], false)] : [])
	]);
	await Promise.all(racing);
	const seen = await roster(at('site'));
	expect(seen.unreadable).toBe(0);
	const states = labels.map((label) => named(seen, label)?.state);
	expect(states).toEqual([...Array(4).fill('completed'), ...Array(8).fill('working')]);
}, 60_000);

test('what an owner may state is bounded, and an assignment the registry does not know is marked', async () => {
	const refused: string[][] = [
		['register'],
		['register', '--label', 'x'.repeat(121)],
		['register', '--label', 'Bad unit', '--units', 'not a unit!'],
		['register', '--label', 'No time', '--ttl', '0'],
		['register', '--label', 'Bad id', '--id', '../escape']
	];
	for (const args of refused) {
		expect([args.slice(0, 3).join(' '), (await run(at('quiet'), args, false)).exitCode]).toEqual([
			args.slice(0, 3).join(' '),
			1
		]);
	}
	expect((await roster(at('quiet'))).tracking).toBe('never-used');
	await register(at('foreign'), 'Assigned', ['--units', 'service.nothing']);
	expect(named(await roster(at('foreign')), 'Assigned')?.unknownUnits).toEqual(['service.nothing']);
});
