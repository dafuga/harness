import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { RunCancelled } from '../src/models/AgentRunner.types';
import { fixture, git } from './run-fixture';

const contract = {
	inputs: [{ name: 'milliseconds', type: 'number' }],
	outputs: [{ name: 'formatted', type: 'string' }],
	errors: ['negative-value']
};
const proposal = JSON.stringify({
	category: 'functions',
	title: 'Format time',
	goal: 'Readable elapsed time',
	proposal: 'Input 1500 returns 1.5 seconds',
	contract
});
const request = (f: Awaited<ReturnType<typeof fixture>>, extra: object = {}) =>
	({
		intent: 'create',
		category: 'functions',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text: 'Add a formatter',
		projectId: f.session.projectId!,
		...extra
	}) as unknown as RunRequest;

test('a pinned commit rejects project creation before any CLI or plan write', async () => {
	const f = await fixture();
	const before = git(f.root, 'rev-parse', 'HEAD');
	await f.session.snapshot({ branch: 'main', commit: before });
	await expect(f.service.start(request(f))).rejects.toThrow(/read-only|Historical/i);
	expect(f.run).not.toHaveBeenCalled();
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect(f.session.busy).toBe(false);
}, 20000);

test('an unlisted model and the wrong project reject before creation', async () => {
	const f = await fixture();
	const before = git(f.root, 'rev-parse', 'HEAD');
	await expect(f.service.start(request(f, { model: 'not-listed' }))).rejects.toThrow();
	await expect(
		f.service.start(request(f, { projectId: 'local-' + 'f'.repeat(64) }))
	).rejects.toThrow(/project/i);
	expect(f.run).not.toHaveBeenCalled();
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect(f.session.busy).toBe(false);
}, 20000);

test('unexpected source writes during proposal generation remain recoverable and create no plan', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => {
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'unexpected draft');
		return { text: proposal, model: turn.model };
	});
	await f.service.start(request(f));
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(await readFile(join(f.root, 'src/owned.ts'), 'utf8')).toBe('unexpected draft');
	expect(
		(await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'))).map((plan) => plan.title)
	).toEqual(['Target']);
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'failed', message: expect.stringMatching(/changed|write/i) })
	);
	expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
}, 20000);

test('only the owning run may cancel, and a cancelled proposal writes no plan', async () => {
	const f = await fixture();
	let entered!: () => void;
	const ready = new Promise<void>((resolve) => {
		entered = resolve;
	});
	f.run.mockImplementation((turn) => {
		entered();
		return new Promise((_resolve, reject) =>
			turn.signal.addEventListener('abort', () => reject(new RunCancelled()), { once: true })
		);
	});
	const before = git(f.root, 'rev-parse', 'HEAD');
	const started = await f.service.start(request(f));
	await ready;
	expect(f.service.cancel('another-run')).toBe(false);
	expect(f.service.cancel(started.runId)).toBe(true);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect(f.events).toContainEqual({ runId: started.runId, kind: 'cancelled' });
	expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
}, 20000);

test('a branch changed during the read-only proposal cannot receive its plan', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => {
		git(f.root, 'checkout', '-b', 'another-branch');
		return { text: proposal, model: turn.model };
	});
	const before = git(f.root, 'rev-parse', 'HEAD');
	await f.service.start(request(f));
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'failed', message: expect.stringMatching(/branch/i) })
	);
}, 20000);

test('a source revision advanced during proposal generation receives no new plan', async () => {
	const f = await fixture();
	let advanced = '';
	f.run.mockImplementation(async (turn) => {
		git(f.root, 'commit', '--allow-empty', '-m', 'chore: another owner advanced source');
		advanced = git(f.root, 'rev-parse', 'HEAD');
		return { text: proposal, model: turn.model };
	});
	await f.service.start(request(f));
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(advanced);
	expect((await f.planning.plans(advanced)).map((plan) => plan.title)).toEqual(['Target']);
	expect(f.events).toContainEqual(
		expect.objectContaining({
			kind: 'failed',
			message: expect.stringMatching(/revision|commit|advanced|changed/i)
		})
	);
}, 20000);

test('a creation request without a project refuses before the CLI', async () => {
	const f = await fixture();
	const before = git(f.root, 'rev-parse', 'HEAD');
	await expect(f.service.start(request(f, { projectId: undefined }))).rejects.toThrow(/project/i);
	expect(f.run).not.toHaveBeenCalled();
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
}, 20000);
