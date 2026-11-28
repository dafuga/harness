import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { trackerRunSchema } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerContextHandoffs } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerContextHandoff';
import { trackerWatchdogPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPort';
import {
	readWatchdogAlerts,
	watchdogItem
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';
import { sampleTrackerContexts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogContext';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { trackerRecoveryLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionHealthRuntime';
import { recoverTrackerSession } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerSessionRecovery';
import { fixturePolicy } from '../../support/trackerDispatcherFixture';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import type {
	WatchdogPane,
	WatchdogScan
} from '../../../src/services/projects-sessions/WatchdogPaneService.types';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';
const itemId = 'abc123def4';
const host = 'harbor-mbp-2';
const createdAt = 1_800_000_000_000;
const minute = 60_000;
const signal = new AbortController().signal;
const pane: WatchdogPane = {
	name: 'auto-abc123-r9',
	key: 'fixture:9',
	activity: createdAt,
	createdAt,
	x: 2,
	y: 2,
	live: true,
	runnerSocket: true,
	ready: true,
	readable: true,
	attached: false,
	currentCommand: 'codex',
	screen: 'fixture\n\n› \n\n40% context left'
};

test('samples active provider context at the exact pane directory and rejects ambiguity', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'watchdog-context-sample',
		() => withTempDir('hnt-watch-context-', proveSamples)
	));

async function proveSamples(root: string) {
	const codex = join(root, 'codex');
	const claude = join(root, 'claude');
	mkdirSync(codex);
	mkdirSync(claude);
	const timestamp = new Date(createdAt).toISOString();
	const rollout = [
		{ type: 'session_meta', payload: { cwd: codex, timestamp } },
		{ type: 'turn_context', payload: { model: 'gpt-6.1-terra', effort: 'high' } },
		{
			type: 'event_msg',
			payload: {
				type: 'token_count',
				info: {
					last_token_usage: { input_tokens: 150_001 },
					total_token_usage: { input_tokens: 900_000 }
				}
			}
		}
	];
	writeTranscript(codex, '00000000', rollout);
	writeTranscript(claude, '00000001', [
		{ cwd: claude, timestamp, type: 'user' },
		{
			type: 'assistant',
			message: {
				model: 'claude-opus-5-5',
				usage: {
					input_tokens: 20,
					cache_read_input_tokens: 150_000,
					cache_creation_input_tokens: 40
				}
			}
		}
	]);
	const panes = [
		{ ...pane, cwd: codex },
		{ ...pane, cwd: claude }
	];
	expect(await sampleTrackerContexts(panes, [root], signal)).toMatchObject([
		{ contextTokens: 150_001, model: 'gpt-6.1-terra', effort: 'high' },
		{ contextTokens: 150_060, model: 'claude-opus-5-5' }
	]);
	writeTranscript(codex, '00000002', rollout);
	expect((await sampleTrackerContexts(panes, [root], signal))[0].contextTokens).toBeUndefined();
}

function writeTranscript(directory: string, prefix: string, rows: unknown[]) {
	const file = join(directory, `${prefix}-0000-0000-0000-000000000000.jsonl`);
	writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
	utimesSync(file, new Date(createdAt), new Date(createdAt));
}

test('requests a handoff once and closes only the idle owned attempt after its note', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'watchdog-context-handoff',
		async () => {
			await proveHandoff(true);
			await proveHandoff(false);
		}
	));

async function proveHandoff(sampled: boolean) {
	let now = createdAt + 11 * minute;
	const db = new DatabaseSync(':memory:');
	try {
		const store = new TrackerPersistenceService(db, host, { now: () => now });
		seedHandoffItem(store);
		const attempt = seedHandoffRun(db);
		const repo = new TrackerItemReadRepository(store.database);
		const scan = (activity: number): WatchdogScan & { canRelaunch: boolean } => ({
			host,
			now,
			canRelaunch: true,
			items: [watchdogItem(repo.getStored(itemId))],
			runs: [
				{ id: 9, itemId, tmux: pane.name, state: 'running', cli: 'codex', startedAt: createdAt }
			],
			panes: [{ ...pane, activity, contextTokens: sampled ? 150_001 : undefined }]
		});
		const nudge = vi.fn(async () => true);
		const close = vi.fn(
			async ({
				stillComplete,
				attempt: token
			}: {
				stillComplete: () => boolean;
				attempt?: string;
			}) => token === attempt && stillComplete()
		);
		const driver = { ...trackerWatchdogPort({ transcriptRoots: [] }, host), nudge, close };
		await trackerContextHandoffs(store, driver, scan(now), signal);
		await trackerContextHandoffs(store, driver, scan(createdAt), signal);
		await trackerContextHandoffs(store, driver, scan(createdAt), signal);
		expect(nudge).not.toHaveBeenCalled();
		store.appendLocal({ itemId, fields: { schedule_off: 0, needs_daniel: 0 } });
		await trackerContextHandoffs(store, driver, scan(createdAt), signal);
		expect(nudge).toHaveBeenCalledTimes(Number(sampled));
		expect(close).not.toHaveBeenCalled();
		store.appendLocal({
			itemId,
			fields: {
				'note+':
					'stopped: watchdog context handoff; resume from: fixture worktree, feat/fixture, tests pending'
			}
		});
		now += 11 * minute;
		await trackerContextHandoffs(store, driver, scan(now), signal);
		expect(close).not.toHaveBeenCalled();
		await trackerContextHandoffs(store, driver, scan(now - 11 * minute), signal);
		expect(close).toHaveBeenCalledOnce();
		expect(readWatchdogAlerts(store)[`${itemId}:context`].reason).toContain('closed the idle pane');
		await proveContinuation(store, repo, now);
	} finally {
		db.close();
	}
}

async function proveContinuation(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	now: number
) {
	const { database } = store;
	database.prepare("UPDATE runs SET state = 'finished', ended_at = ? WHERE id = 9").run(now);
	const dispatch = new TrackerDispatcherService(
		new TrackerDispatchRepository(store),
		fixturePolicy(() => now, { node: host })
	);
	const request = { item: items.getStored(itemId), launch: trackerRecoveryLaunch(dispatch)!, now };
	expect(request.item.status).toBe('in_progress');
	await recoverTrackerSession(store, request);
	await recoverTrackerSession(store, { ...request, item: items.getStored(itemId) });
	expect(database.prepare('SELECT item_id,model,effort FROM runs WHERE id > 9').all()).toEqual([
		{ item_id: itemId, model: 'gpt-6.2-sol', effort: 'high' }
	]);
	expect(items.getStored(itemId).launch_source).toBe('recovery');
}

function seedHandoffItem(store: TrackerPersistenceService) {
	store.appendLocal({
		itemId,
		fields: {
			status: 'in_progress',
			computer: host,
			model: 'gpt-6.1-terra:medium',
			title: 'Handoff item',
			kind: 'task',
			schedule_off: true,
			needs_daniel: 1,
			question: 'Please review the proposed wording when convenient.'
		}
	});
}

function seedHandoffRun(db: DatabaseSync) {
	const attempt = 'a'.repeat(64);
	db.exec(trackerRunSchema);
	db.prepare(
		`INSERT INTO runs(id,item_id,rung,cli,model,effort,state,queued_at,started_at,tmux,session_id)
			VALUES(9,?,'manual','codex','gpt-6.2-sol','high','running',?,?,?,?)`
	).run(itemId, createdAt, createdAt, pane.name, attempt);
	return attempt;
}
