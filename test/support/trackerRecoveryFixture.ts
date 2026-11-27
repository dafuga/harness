import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { idleNodeRuntime } from './trackerHostResourceFixture';
import {
	managedFixtureBindings,
	managedForegroundConfig,
	managedTrackerItemRequest
} from './trackerManagedProcessFixture';
import {
	seedTask,
	verifyFailureBudget,
	verifyKilledReminder,
	verifyResumeBrief,
	verifyStoppedRun
} from './trackerRecoveryAssertions';
import { measureWorkload } from './measureWorkload';
import { withTempRepo } from './temporary';

export const tmuxExecutable = ['/opt/homebrew/bin/tmux', '/usr/local/bin/tmux'].find(existsSync);
const id = 'recovr1234';
const occupantId = 'occupy1234';
const minute = 60_000;

export function proveTrackerTmuxRecovery() {
	return measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'managed-tmux-recovery',
		() =>
			withTempRepo(async ({ root, git }) => {
				git('commit', '--allow-empty', '-m', 'Tracker fixture source');
				await proveRecovery(realpathSync(root));
			}, 'hnt-recovery-')
	);
}

async function proveRecovery(root: string) {
	const { config } = managedFixtureBindings(root);
	const socket = 'harness-' + basename(root);
	writeFileSync(config.tmux, isolatedTmux(socket), { mode: 0o700 });
	writeFileSync(config.native.codex, '#!/bin/sh\nexec /bin/sleep 120\n', { mode: 0o700 });
	const tmux = (...args: string[]) =>
		execFileSync(tmuxExecutable!, ['-L', socket, ...args], { encoding: 'utf8', stdio: 'pipe' });
	const database = new DatabaseSync(':memory:');
	let offset = Date.parse('2026-11-25T09:00:00Z') - Date.now();
	const realNow = Date.now;
	const clock = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
	const options = idleNodeRuntime(managedForegroundConfig(root, config, 'macos'));
	const makeRuntime = () =>
		new TrackerNativeRuntimeService(database, {
			...options,
			now: Date.now,
			hostEffects: { ...options.hostEffects, watchdog: { tmux: config.tmux } }
		});
	let runtime = makeRuntime();
	const signal = AbortSignal.timeout(35_000);
	const dispatch = () => runtime.scheduler!.tick(signal);
	const watchdog = async (delay: number) => {
		offset += delay;
		await dispatch();
		await runtime.watchdog!.tick(signal);
		await dispatch();
	};
	const items = new TrackerItemReadRepository(database);
	try {
		await startAndDrop(runtime, database, { dispatch, tmux });
		await watchdog(minute);
		await verifyEligibleRecovery(
			runtime,
			{ database, directory: config.stateDirectory, items },
			{ dispatch, tmux, watchdog }
		);
		tmux('kill-session', '-t', '=auto-recovr-r3');
		await dispatch();
		writeFileSync(join(root, 'reject-boot'), '');
		runtime = makeRuntime();
		await verifyFailureBudget({ id, watchdog, items, database });
		unlinkSync(join(root, 'reject-boot'));
		await verifyStoppedRun(runtime, { dispatch, tmux, watchdog });
		await verifyKilledReminder(runtime, { dispatch, tmux, watchdog });
	} finally {
		try {
			tmux('kill-server');
		} catch {
			// The isolated server disappears when its final session ends.
		}
		database.close();
		clock.mockRestore();
	}
}
async function verifyEligibleRecovery(
	runtime: TrackerNativeRuntimeService,
	{
		database,
		directory,
		items
	}: { database: DatabaseSync; directory: string; items: TrackerItemReadRepository },
	{
		dispatch,
		tmux,
		watchdog
	}: {
		dispatch: () => Promise<void>;
		tmux: (...args: string[]) => string;
		watchdog: (delay: number) => Promise<void>;
	}
) {
	expect(database.prepare('SELECT COUNT(*) AS total FROM runs').get()).toEqual({ total: 1 });
	expect(items.getStored(id)).toMatchObject({
		status: 'blocked',
		blocked_reason: expect.stringContaining('automatic launch opted out')
	});
	runtime.store.appendLocal({
		itemId: id,
		fields: { schedule_off: 0, status: 'in_progress', blocked_reason: null }
	});
	await waitForRecoveryCapacity(runtime, database, { dispatch, tmux, watchdog });
	await watchdog(11 * minute);
	await expect
		.poll(async () => {
			await dispatch();
			return database.prepare('SELECT state,cli,model,effort FROM runs WHERE id = 3').get();
		})
		.toEqual({ state: 'running', cli: 'codex', model: 'gpt-6.1-terra', effort: 'high' });
	verifyResumeBrief(directory, 3);
	expect(items.getStored(id)).toMatchObject({ schedule_off: false, needs_daniel: false });
}

async function waitForRecoveryCapacity(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	{
		dispatch,
		tmux,
		watchdog
	}: {
		dispatch: () => Promise<void>;
		tmux: (...args: string[]) => string;
		watchdog: (delay: number) => Promise<void>;
	}
) {
	seedTask(runtime, Date.now(), occupantId);
	expect((await managedTrackerItemRequest(runtime, occupantId, 'launch')).ok).toBe(true);
	await expect
		.poll(async () => {
			await dispatch();
			return database.prepare('SELECT state FROM runs WHERE id = 2').get();
		})
		.toEqual({ state: 'running' });
	for (let step = 0; step < 4; step++) await watchdog(11 * minute);
	const waiting = new TrackerItemReadRepository(database).getStored(id);
	expect(waiting).toMatchObject({ status: 'open', needs_daniel: false });
	expect(waiting.notes_log.some(({ text }) => /Relaunch [0-9]+\/3 failed:/.test(text))).toBe(false);
	expect(
		database.prepare('SELECT id, state FROM runs WHERE item_id = ? ORDER BY id').all(id)
	).toEqual([
		{ id: 1, state: 'finished' },
		{ id: 3, state: 'queued' }
	]);
	expect((await managedTrackerItemRequest(runtime, occupantId, 'done')).ok).toBe(true);
	tmux('kill-session', '-t', '=auto-occupy-r2');
}

async function startAndDrop(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	{ dispatch, tmux }: { dispatch: () => Promise<void>; tmux: (...args: string[]) => string }
) {
	seedTask(runtime, Date.now(), id);
	for (let index = 0; index < 12; index++)
		runtime.store.appendLocal({ itemId: id, fields: { 'note+': 'Progress note ' + index } });
	expect((await managedTrackerItemRequest(runtime, id, 'launch')).ok).toBe(true);
	await expect
		.poll(async () => {
			await dispatch();
			return database.prepare('SELECT state FROM runs WHERE id = 1').get();
		})
		.toMatchObject({ state: 'running' });
	expect((await managedTrackerItemRequest(runtime, id, 'start')).ok).toBe(true);
	runtime.store.appendLocal({
		itemId: id,
		fields: { schedule_off: true, model: 'gpt-6.2-sol:low' }
	});
	tmux('kill-session', '-t', '=auto-recovr-r1');
	await dispatch();
	expect(database.prepare('SELECT state,outcome FROM runs WHERE id = 1').get()).toEqual({
		state: 'finished',
		outcome: 'abandoned'
	});
}

function isolatedTmux(socket: string) {
	return `#!${process.execPath}
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const args = process.argv.slice(2);
args[args.indexOf('-L') + 1] = ${JSON.stringify(socket)};
if (args.includes('new-session') && existsSync(join(__dirname, 'reject-boot'))) process.exit(1);
const result = spawnSync(${JSON.stringify(tmuxExecutable)}, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
`;
}
