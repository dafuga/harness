import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { TrackerDispatchSchedulerService } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	fixturePolicy,
	primary,
	sampleId,
	sampleToken
} from '../../support/trackerDispatcherFixture';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const now = () => 1780000000000;
const policy = fixturePolicy(now);
const signal = new AbortController().signal;

function openDispatcher(path: string) {
	const database = new DatabaseSync(path);
	const store = new TrackerPersistenceService(database, primary, { now });
	const repo = new TrackerDispatchRepository(store);
	const dispatcher = new TrackerDispatcherService(repo, policy);
	return { database, store, repo, dispatcher };
}

const childProgram = `
const { writeFileSync } = require('node:fs');
const [path, key, startedAt] = process.argv.slice(1);
writeFileSync(path, JSON.stringify({ pid: process.pid, key, startedAt: Number(startedAt) }), { mode: 0o600 });
process.stdout.write('ready');
setInterval(() => {}, 60000);
`;

test('adopts an uncertain start after restart without releasing the attempt twice', () =>
	measureWorkload('service.projects-sessions-tracker-dispatch-scheduler', 'managed-adoption', () =>
		withTempDir('tracker-managed-child-', proveManagedAdoption)
	));

async function proveManagedAdoption(root: string) {
	const dbPath = join(root, 'tracker.db');
	let state = openDispatcher(dbPath);
	const fixture = managedRunner(root, () => state);

	const { runner } = fixture;
	try {
		queueFixtureItem(state.store);
		const scheduler = new TrackerDispatchSchedulerService(state.repo, state.dispatcher, {
			runner,
			policy
		});
		await expect(scheduler.tick(signal)).rejects.toThrow('lost start reply');
		expect(() => state.repo.assertLegacyRollbackSafe()).toThrow('(queued)');
		state.database.close();
		state = openDispatcher(dbPath);
		const restarted = new TrackerDispatchSchedulerService(state.repo, state.dispatcher, {
			runner,
			policy
		});
		runner.observe.mockResolvedValueOnce({
			type: 'session',
			session: { key: 'unrelated-key', id: 'unrelated', startedAt: now(), state: 'live' }
		});
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([{ state: 'queued' }]);
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([
			{ id: 1, state: 'running', session_id: `fixture-${fixture.child?.pid}` }
		]);
		expect(runner.start).toHaveBeenCalledTimes(1);
		expect(runner.observe.mock.calls.map(([, key]) => key)).toEqual([
			fixture.startedKey,
			fixture.startedKey
		]);
	} finally {
		fixture.child?.kill();
		await fixture.exited;
		state.database.close();
	}
}

function queueFixtureItem(store: TrackerPersistenceService) {
	store.appendLocal({
		itemId: sampleId,
		fields: {
			title: 'Fixture',
			kind: 'task',
			status: 'open',
			auto: sampleToken,
			computer: 'mac'
		}
	});
}

function managedRunner(root: string, current: () => ReturnType<typeof openDispatcher>) {
	const receiptPath = join(root, 'receipt.json');
	const fixture: {
		child?: ReturnType<typeof spawn>;
		exited?: Promise<unknown>;
		startedKey: string;
	} = { startedKey: '' };
	const start = vi.fn<TrackerDispatchRunner['start']>(async (reservation) => {
		expect(current().repo.managedRuns()).toMatchObject([{ state: 'queued', dispatch_at: now() }]);
		fixture.startedKey = reservation.key;
		const child = spawn(
			process.execPath,
			['-e', childProgram, receiptPath, fixture.startedKey, String(now())],
			{
				stdio: ['ignore', 'pipe', 'ignore'],
				env: {}
			}
		);
		fixture.child = child;
		const exited = once(child, 'close');
		fixture.exited = exited;
		await Promise.race([
			once(child.stdout, 'data'),
			exited.then(() => {
				throw new Error('fixture child exited before receipt');
			})
		]);
		throw new Error('lost start reply');
	});
	const observe = vi.fn<TrackerDispatchRunner['observe']>(async (_run, key) => {
		const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
		if (receipt.key !== key || receipt.pid !== fixture.child?.pid) return undefined;
		process.kill(receipt.pid, 0);
		return {
			type: 'session',
			session: { key, id: `fixture-${receipt.pid}`, startedAt: receipt.startedAt, state: 'live' }
		};
	});
	return Object.assign(fixture, { runner: { start, observe } });
}
