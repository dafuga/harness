import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RunCancelled } from '../src/models/AgentRunner.types';
import { approve, fixture, git, settled } from './run-fixture';

/**
 * What the agent of a Change said is kept in the notice of that change, so a thread that is
 * opened again shows it with its references. A run that failed or was cancelled keeps what was
 * said until then, above a notice that says how it ended and that verification is pending.
 */
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function notice(f: Fixture) {
	const head = git(f.root, 'rev-parse', 'HEAD');
	const said = await f.planning.messages(f.request.entityId, f.request.threadId, head);
	return said.filter((message) => message.mode === 'change').at(-1)!.text;
}

test('a completed change keeps the reply of its agent and names the entity it implements', async () => {
	const f = await fixture(async (turn) => {
		turn.onText('Working on it.');
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'agent revision');
	});
	await settled(f, await approve(f));
	const body = await notice(f);
	// The fixture runner answers "Precise design direction": the final reply, not the stream.
	expect(body.startsWith('Precise design direction\n\nChange completed: 1 project files;')).toBe(
		true
	);
	expect(body.endsWith('Verification pending.')).toBe(true);
	expect(f.events).toContainEqual(
		expect.objectContaining({
			kind: 'status',
			phase: 'changing',
			detail: `Implementing [[unit:${f.request.entityId}]] with codex / selected`
		})
	);
	expect(f.events).toContainEqual(
		expect.objectContaining({ kind: 'text', text: 'Working on it.' })
	);
}, 60000);

test('a failed change keeps the text its agent streamed before failing', async () => {
	const f = await fixture(async (turn) => {
		turn.onText('Halfway through [[unit:app.function.owned]]');
		turn.onText(', then the tests.');
		throw new Error('Fixture agent failed');
	});
	await settled(f, await approve(f));
	const body = await notice(f);
	expect(body.startsWith('Halfway through [[unit:app.function.owned]], then the tests.\n\n')).toBe(
		true
	);
	expect(body).toContain('Change failed: 0 project files;');
	expect(body).not.toContain('Change completed');
}, 60000);

test('a cancelled change keeps what was said before the cancellation', async () => {
	let entered!: () => void;
	const ready = new Promise<void>((resolve) => (entered = resolve));
	const f = await fixture((turn) => {
		turn.onText('Started on the badge.');
		entered();
		return new Promise((_resolve, reject) =>
			turn.signal.addEventListener('abort', () => reject(new RunCancelled()), { once: true })
		);
	});
	const started = await f.service.start(await approve(f));
	await ready;
	expect(f.service.cancel(started.runId)).toBe(true);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	const body = await notice(f);
	expect(body.startsWith('Started on the badge.\n\nChange cancelled:')).toBe(true);
}, 60000);

test('a change whose agent said nothing keeps the notice alone', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => ({ text: '  ', model: turn.model }));
	await settled(f, await approve(f));
	expect((await notice(f)).startsWith('Change completed: 0 project files;')).toBe(true);
}, 60000);
