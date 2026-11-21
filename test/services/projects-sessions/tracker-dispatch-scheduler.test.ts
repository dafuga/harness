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
	const receiptPath = join(root, 'receipt.json');
	let state = openDispatcher(dbPath);
	let child: ReturnType<typeof spawn> | undefined;
	let exited: Promise<unknown> | undefined;
	let startedKey = '';
	const start = vi.fn<TrackerDispatchRunner['start']>(async (reservation) => {
		expect(state.repo.managedRuns()).toMatchObject([{ state: 'queued', dispatch_at: now() }]);
		startedKey = reservation.key;
		child = spawn(process.execPath, ['-e', childProgram, receiptPath, startedKey, String(now())], {
			stdio: ['ignore', 'pipe', 'ignore'],
			env: {}
		});
		exited = once(child, 'close');
		await Promise.race([
			once(child.stdout!, 'data'),
			exited.then(() => {
				throw new Error('fixture child exited before receipt');
			})
		]);
		throw new Error('lost start reply');
	});
	const observe = vi.fn<TrackerDispatchRunner['observe']>(async (_run, key) => {
		const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
		if (receipt.key !== key || receipt.pid !== child?.pid) return undefined;
		process.kill(receipt.pid, 0);
		return {
			type: 'session',
			session: { key, id: `fixture-${receipt.pid}`, startedAt: receipt.startedAt, state: 'live' }
		};
	});
	const runner = { start, observe };
	try {
		state.store.appendLocal({
			itemId: sampleId,
			fields: {
				title: 'Fixture',
				kind: 'task',
				status: 'open',
				auto: sampleToken,
				computer: 'mac'
			}
		});
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
		observe.mockResolvedValueOnce({
			type: 'session',
			session: { key: 'unrelated-key', id: 'unrelated', startedAt: now(), state: 'live' }
		});
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([{ state: 'queued' }]);
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([
			{ id: 1, state: 'running', session_id: `fixture-${child?.pid}` }
		]);
		expect(start).toHaveBeenCalledTimes(1);
		expect(observe.mock.calls.map(([, key]) => key)).toEqual([startedKey, startedKey]);
	} finally {
		child?.kill();
		await exited;
		state.database.close();
	}
}
