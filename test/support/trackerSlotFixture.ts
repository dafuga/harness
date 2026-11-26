import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerSlotFixture, TrackerSlotPane } from './trackerSlotFixture.types';

const node = 'daniel-primary-mbp';
const signal = new AbortController().signal;
export const protectedPanes = ['cos', 'credential-broker-mac', 'deploy-abc123', 'rng-poker-keeper'];
const footer = '  ⏵⏵ bypass permissions on';
export const composer = (status = footer) =>
	['─'.repeat(20), '❯ ', '─'.repeat(20), status].join('\n');
export const codexComposer = (background = '') =>
	[background, '› ', '', '  gpt-6.2-sol high · ~/work'].join('\n');

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

const shared = `
const fs = require('node:fs');
const path = require('node:path');
const state = path.join(__dirname, 'panes.json');
const panes = JSON.parse(fs.readFileSync(state, 'utf8'));
`;

const tmuxProgram = `${shared}
const [,,, socket, command, ...args] = process.argv;
if (socket !== 'default') process.exit(2);
const line = (name) => { const pane = panes[name];
	return [name, pane.created, 71, pane.id, 200, Math.floor(pane.activity), 2, 1, 0, 0, 0,\n\t\tpane.attached ? 1 : 0, 1, 1, 'claude'].join('|'); };
const byId = (id) => Object.keys(panes).find((name) => panes[name].id === id);
const target = args[args.indexOf('-t') + 1];
if (command === 'list-panes') process.stdout.write(Object.keys(panes).map(line).join('\\n') + '\\n');
else if (command === 'capture-pane') process.stdout.write(panes[byId(target)].screen);
else if (command === 'display-message')
	process.stdout.write((args.at(-1).includes('session_name') ? line(byId(target)) : __dirname) + '\\n');
else if (command === 'if-shell' && args.join(' ').includes('kill-session')) {
	if (panes[byId(target)].unkillable) process.exit(0);
	delete panes[byId(target)];
	fs.writeFileSync(state, JSON.stringify(panes));
	process.stdout.write('tracker-session-closed\\n');
} else if (command === 'if-shell' || command === 'send-keys')
	fs.appendFileSync(path.join(__dirname, 'input.log'), args.join(' ') + '\\n');
else process.exit(2);
`;

const driverProgram = `${shared}
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const ledger = path.join(__dirname, 'sessions.json');
const sessions = fs.existsSync(ledger) ? JSON.parse(fs.readFileSync(ledger, 'utf8')) : [];
if (process.argv[2] === 'start') {
	const { itemId, key, queuedAt, runId } = input;
	const tmux = 'auto-' + itemId.slice(0, 6) + '-r' + runId;
	const session = { itemId, key, id: 'synthetic-' + runId, tmux, state: 'live', startedAt: queuedAt };
	fs.writeFileSync(ledger, JSON.stringify([...sessions, session]));
	panes[tmux] = { id: '%' + runId, created: Math.floor(queuedAt / 1000), activity: queuedAt / 1000,
		screen: 'Working (esc to interrupt)' };
	fs.writeFileSync(state, JSON.stringify(panes));
	process.stdout.write(JSON.stringify({ status: 'started', session }));
} else if (process.argv[2] === 'inspect')
	process.stdout.write(JSON.stringify(sessions.filter(({ tmux }) => panes[tmux]).map((session) => {
		const { exit } = panes[session.tmux];
		return exit === undefined ? session : { ...session, state: 'exited', exitCode: exit };
	})));
else process.stdout.write('true');
`;
