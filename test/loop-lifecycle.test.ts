import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test, vi } from 'vitest';
import { withTempDir } from './support/temporary';
import { registerLoopLifecycleCommands } from '../src/cli/program/loopLifecycle';
import { addLoopStep, completeLoopStep, renderLoopStatus } from '../src/cli/program/manageLoop';
import { evaluateLoop } from '../src/cli/program/loopEvaluate';
import { closeLoopAbandoned } from '../src/workflows/development-tooling/loop-lifecycle/closeLoop';
import {
	isOpenLoop,
	loopActivity
} from '../src/workflows/development-tooling/loop-lifecycle/loopActivity';
import {
	listOpenLoops,
	renderOpenLoops
} from '../src/workflows/development-tooling/loop-lifecycle/listOpenLoops';
import { readLoop } from '../src/workflows/development-tooling/loop-state/loopState';
import type { LoopState } from '../src/workflows/development-tooling/loop-state/loopState.types';

const now = '2026-11-13T12:00:00.000Z';
let root = '';

afterEach(() => {
	vi.restoreAllMocks();
});

function loopState(name: string, updatedAt: string, steps: string[], extra = {}): LoopState {
	return {
		name,
		goal: `Goal of ${name}`,
		createdAt: '2026-09-01T00:00:00.000Z',
		updatedAt,
		steps: steps.map((status, index) => ({
			id: `step-${index}`,
			title: `Step ${index}`,
			status: status as 'pending' | 'complete'
		})),
		...extra
	};
}

async function seed(state: LoopState, raw?: string): Promise<void> {
	const dir = join(root, 'specification', 'loops', state.name);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, 'loop.json'), raw ?? `${JSON.stringify(state, null, '\t')}\n`);
}

async function seedFixtures(): Promise<void> {
	await seed(
		loopState('stale-open', '2026-10-04T12:00:00.000Z', ['complete', 'pending', 'pending'])
	);
	await seed(loopState('fresh-open', '2026-11-12T12:00:00.000Z', ['pending']));
	await seed(loopState('done-old', '2026-09-02T00:00:00.000Z', ['complete']));
	await seed(
		loopState('closed-old', '2026-09-02T00:00:00.000Z', ['pending'], {
			closed: { status: 'abandoned', reason: 'superseded', closedAt: '2026-09-03T00:00:00.000Z' }
		})
	);
	await seed(loopState('broken', now, []), '{ not json');
}

test('listOpenLoops keeps open loops idle for N days, oldest first, with age and open count', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		await seedFixtures();

		const stale = await listOpenLoops({ root, now: () => now, staleDays: 30 });
		expect(stale.loops).toEqual([
			expect.objectContaining({
				name: 'stale-open',
				ageDays: 40,
				openSteps: 2,
				totalSteps: 3,
				lastActivityAt: '2026-10-04T12:00:00.000Z'
			})
		]);
		expect(stale.unreadable.map((item) => item.name)).toEqual(['broken']);

		const all = await listOpenLoops({ root, now: () => now });
		expect(all.loops.map((loop) => loop.name)).toEqual(['stale-open', 'fresh-open']);
		expect(all.loops[1]).toMatchObject({ ageDays: 1, openSteps: 1 });
	}));

test('a recent step completion counts as activity even when updatedAt is old', () => {
	const state = loopState('active', '2026-09-02T00:00:00.000Z', ['complete', 'pending']);
	state.steps[0].completedAt = '2026-11-10T12:00:00.000Z';

	expect(loopActivity(state, now)).toMatchObject({ ageDays: 3, openSteps: 1 });
});

test('listOpenLoops treats a missing loops directory as no loops', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		expect(await listOpenLoops({ root, now: () => now })).toEqual({ loops: [], unreadable: [] });
		expect(renderOpenLoops({ loops: [], unreadable: [] }, 30)).toBe('No idle for 30+ days loops.');
		await expect(listOpenLoops({ root, staleDays: -1 })).rejects.toThrow('Stale days');
	}));

test('closeLoopAbandoned records the closure and leaves steps and old loops untouched', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		const before = loopState('stale-open', '2026-10-04T12:00:00.000Z', ['complete', 'pending']);
		await seed(before);

		const status = await closeLoopAbandoned({
			root,
			loop: 'stale-open',
			reason: ' superseded by new plan ',
			now: () => now
		});

		const stored = await readLoop(join(root, 'specification', 'loops', 'stale-open', 'loop.json'));
		expect(status.state).toEqual(stored);
		expect(stored.steps).toEqual(before.steps);
		expect(stored.closed).toEqual({
			status: 'abandoned',
			reason: 'superseded by new plan',
			closedAt: now
		});
		expect(isOpenLoop(stored)).toBe(false);
		const trace = await readFile(
			join(root, 'specification', 'loops', 'stale-open', 'trace.ndjson'),
			'utf8'
		);
		expect(JSON.parse(trace.trim())).toMatchObject({
			event: 'loop.closed',
			reason: stored.closed?.reason
		});
		expect((await listOpenLoops({ root, now: () => now })).loops).toEqual([]);
		const path = join(root, 'specification', 'loops', 'stale-open', 'loop.json');
		const closedBytes = await readFile(path, 'utf8');
		for (const mutate of [
			() => addLoopStep({ root, loop: 'stale-open', step: 'later', title: 'Later' }),
			() => completeLoopStep({ root, loop: 'stale-open', step: 'step-1', evidence: 'proof' }),
			() => evaluateLoop({ root, loop: 'stale-open' })
		]) {
			await expect(mutate()).rejects.toThrow('is closed as abandoned');
			expect(await readFile(path, 'utf8')).toBe(closedBytes);
		}
		expect(
			await readFile(join(root, 'specification', 'loops', 'stale-open', 'trace.ndjson'), 'utf8')
		).toBe(trace);
	}));

test('closeLoopAbandoned refuses an empty reason, a closed loop and a loop with nothing pending', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		await seedFixtures();

		await expect(closeLoopAbandoned({ root, loop: 'fresh-open', reason: '  ' })).rejects.toThrow(
			'Abandon reason cannot be empty.'
		);
		await expect(closeLoopAbandoned({ root, loop: 'closed-old', reason: 'again' })).rejects.toThrow(
			'already closed as abandoned'
		);
		await expect(closeLoopAbandoned({ root, loop: 'done-old', reason: 'why' })).rejects.toThrow(
			'no pending steps'
		);
	}));

test('loops without a closed field read exactly as before', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		const old = loopState('legacy', '2026-10-04T12:00:00.000Z', ['pending']);
		await seed(old);

		const read = await readLoop(join(root, 'specification', 'loops', 'legacy', 'loop.json'));
		expect(read).toEqual(old);
		expect('closed' in read).toBe(false);
	}));

test('renderLoopStatus shows age, open count and a closure', () => {
	const open = loopState('open-one', '2026-10-04T12:00:00.000Z', ['complete', 'pending']);
	const text = renderLoopStatus({ state: open, tracePath: 'trace' }, now);
	expect(text).toContain('Age: 40 days since last activity (2026-10-04T12:00:00.000Z)');
	expect(text).toContain('Open steps: 1 of 2');
	expect(text).not.toContain('Closed:');

	const closed = {
		...open,
		closed: { status: 'abandoned' as const, reason: 'moot', closedAt: now }
	};
	expect(renderLoopStatus({ state: closed, tracePath: 'trace' }, now)).toContain(
		`Closed: abandoned at ${now} - moot`
	);
});

test('loop list and loop close commands run against the working directory', () =>
	withTempDir('harness-loop-lifecycle-', async (directory) => {
		root = directory;
		await seedFixtures();
		vi.spyOn(process, 'cwd').mockReturnValue(root);
		const lines: string[] = [];
		vi.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
		// Commander keeps option values between parses, so every call gets a fresh program.
		const run = (...args: string[]) => {
			const program = new Command().exitOverride();
			registerLoopLifecycleCommands(program.command('loop'));
			return program.parseAsync(['node', 'harness', 'loop', ...args]);
		};

		await run('list', '--stale', '10', '--json');
		const listed = JSON.parse(lines.pop() ?? '{}') as { loops: Array<{ name: string }> };
		expect(listed.loops.map((loop) => loop.name)).toEqual(['stale-open']);

		await expect(run('close', 'stale-open', '--reason', 'x')).rejects.toThrow('Pass --abandoned');
		await expect(run('list', '--stale', 'soon')).rejects.toThrow('--stale needs a number of days');

		await run('close', 'stale-open', '--abandoned', '--reason', 'no longer needed');
		expect(lines.pop()).toContain('Closed: abandoned');
		await run('list');
		expect(lines.pop()).not.toContain('stale-open');
	}));
