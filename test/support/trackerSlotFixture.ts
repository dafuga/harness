import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerSlotFixture, TrackerSlotPane } from './trackerSlotFixture.types';
import { driverProgram, tmuxProgram } from './trackerSlotFixturePrograms';
const node = 'daniel-primary-mbp';
const signal = new AbortController().signal;
export const protectedPanes = ['cos', 'credential-broker-mac', 'deploy-abc123', 'rng-poker-keeper'];
const footer = '  ⏵⏵ bypass permissions on';
export const composer = (status = footer) =>
	['─'.repeat(20), '❯ ', '─'.repeat(20), status].join('\n');
export const codexComposer = (background = '') =>
	[background, '› ', '', '  gpt-6.2-sol high · ~/work'].join('\n');

export async function verifyAnswerAfterExit(hub: TrackerSlotFixture, item: string) {
	await hub.request(`/items/${item}/flag`, { question: 'Choose the synthetic region' });
	await hub.request(`/items/${item}/answer`, { answer: 'Use the first region' });
	const kind = 'answer-delivery';
	const stale = { item_id: item, kind };
	const { generation } = hub.database
		.prepare("SELECT json_extract(clocks, '$.answer') AS generation FROM items WHERE id = ?")
		.get(item)!;
	const alert = {
		...stale,
		id: 'already-queued',
		host: 'daniel-primary-mbp',
		identity: generation,
		session: 'auto-report-r1',
		reason: 'Previously queued answer delivery',
		at: hub.now()
	};
	hub.runtime.store.writeMeta({ watchdog_alerts: JSON.stringify({ [`${item}:${kind}`]: alert }) });
	const alerts = () => hub.runtime.watchdog!.alerts();
	expect
		.soft(alerts(), 'A queued answer alert must disappear when its run has ended')
		.not.toContainEqual(expect.objectContaining(stale));
	await hub.advance(11 * 60_000);
	await hub.advance(60_000);
	expect
		.soft(alerts(), 'An ended run must never raise an answer alert')
		.not.toContainEqual(expect.objectContaining(stale));
	expect(hub.runs(item)).toEqual([{ state: 'finished', outcome: 'abandoned' }]);
	expect(hub.tmuxInput()).not.toContain(`Tracker answer for item ${item}`);
	const notes = hub.database.prepare('SELECT text FROM item_notes WHERE item_id = ?').all(item);
	expect(notes.filter(({ text }) => String(text).includes('no live delivery needed'))).toHaveLength(
		1
	);
}

export async function verifyManualLaunchWithBlockedPane(hub: TrackerSlotFixture) {
	const item = 'retrylive1';
	hub.queue(item);
	await hub.advance(5_000);
	const pane = hub.panes().find((name) => name.startsWith('auto-retryl-'))!;
	expect(pane).toBeDefined();
	await hub.request(`/items/${item}/block`, { reason: 'Synthetic dependency' });
	hub.screen(pane, 'Working (esc to interrupt)');
	await hub.advance(5_000);
	const oldToken = hub.item(item).auto;
	await hub.request(`/items/${item}/unblock`);
	await hub.request(`/items/${item}/launch`);
	expect(hub.item(item).auto).not.toBe(oldToken);
	await hub.advance(5_000);
	expect(hub.panes()).toContain(pane);
	expect(hub.runs(item)).toEqual([{ state: 'finished', outcome: 'blocked' }]);
	hub.screen(pane, composer());
	await hub.advance(35_000);
	await hub.advance(5_000);
	expect(hub.panes()).not.toContain(pane);
	expect(hub.runs(item)).toEqual([
		{ state: 'finished', outcome: 'blocked' },
		{ state: 'running', outcome: null }
	]);
}

/** A one-slot hub with a scripted tmux server. Time and pane activity are explicit. */
export function trackerSlotFixture(root: string, start: number): TrackerSlotFixture {
	const state = join(root, 'panes.json');
	writeFileSync(state, protectedState(start));
	const database = new DatabaseSync(':memory:');
	let clock = start;
	const runtime = new TrackerNativeRuntimeService(database, {
		...trackerNodeRuntime(slotConfig(root)),
		now: () => clock,
		automaticEnabled: () => true
	});
	const panes = paneStore(state);
	return {
		runtime,
		database,
		...panes.views,
		...slotReads(runtime, database),
		screen: (name: string, screen: string) => panes.show(name, screen, clock),
		change: panes.change,
		now: () => clock,
		tmuxInput: () => {
			const log = join(root, 'input.log');
			return existsSync(log) ? readFileSync(log, 'utf8') : '';
		},
		tmux: join(root, 'tmux-fixture'),
		async advance(milliseconds: number) {
			clock += milliseconds;
			await runtime.watchdog!.tick(signal);
			await runtime.scheduler!.tick(signal);
		}
	};
}
function paneStore(state: string) {
	const read = () => JSON.parse(readFileSync(state, 'utf8')) as Record<string, TrackerSlotPane>;
	const allPanes = () => Object.keys(read());
	return {
		views: {
			allPanes,
			panes: () => allPanes().filter((name) => !protectedPanes.includes(name))
		},
		change(name: string, fields: Partial<TrackerSlotPane>) {
			const panes = read();
			panes[name] = { ...panes[name], ...fields };
			writeFileSync(state, JSON.stringify(panes));
		},
		show(name: string, screen: string, at: number) {
			const panes = read();
			panes[name] = { ...panes[name], screen, activity: at / 1000 };
			writeFileSync(state, JSON.stringify(panes));
		}
	};
}
function protectedState(start: number) {
	return JSON.stringify(
		Object.fromEntries(
			protectedPanes.map((name, index) => [
				name,
				{ id: `%${900 + index}`, created: start / 1000, activity: 0, screen: composer() }
			])
		)
	);
}
function slotReads(runtime: TrackerNativeRuntimeService, database: DatabaseSync) {
	return {
		async request(path: string, body: object = {}) {
			const response = await runtime.items.handle(
				new Request('http://tracker-fixture.invalid' + path, {
					method: 'POST',
					body: JSON.stringify(body)
				})
			);
			expect(response.status).toBe(200);
		},
		runs: (itemId: string) =>
			database
				.prepare('SELECT state, outcome FROM runs WHERE item_id = ? ORDER BY id')
				.all(itemId)
				.map((row) => ({ ...row })),
		item: (itemId: string) =>
			database.prepare('SELECT status, auto FROM items WHERE id = ?').get(itemId) as {
				status: string;
				auto: string;
			},
		queue: (itemId: string, model = 'claude-sonnet-5-5:high') =>
			queueSlotItem(runtime, itemId, model)
	};
}
function queueSlotItem(runtime: TrackerNativeRuntimeService, itemId: string, model: string) {
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: `Synthetic slot work ${itemId}`,
			kind: 'task',
			status: 'open',
			project: 'Harness',
			model,
			auto: 'request-' + itemId,
			computer: node,
			launch_target: node,
			launch_source: 'manual',
			'note+': 'auto-launch requested on ' + node
		}
	});
}

function slotConfig(root: string) {
	const executable = (name: string, source: string) => {
		const path = join(root, name);
		writeFileSync(path, `#!${process.execPath}\n${source}`, { mode: 0o700 });
		return path;
	};
	const syncSecretFile = join(root, 'secret');
	writeFileSync(syncSecretFile, 'synthetic-slot-wire-key', { mode: 0o600 });
	const path = join(root, 'node.json');
	writeFileSync(
		path,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 49284,
			syncPort: 49285,
			database: join(root, 'db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile,
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				watchdog: { tmux: executable('tmux-fixture', tmuxProgram) },
				launch: {
					driver: executable('driver', driverProgram),
					maxConcurrent: 1,
					repositories: { Harness: { repo: root, platform: 'linux' } }
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(path);
}
