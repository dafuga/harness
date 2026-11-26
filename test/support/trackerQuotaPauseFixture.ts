import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';

export const quotaNode = 'daniel-primary-mbp';
export const quotaClock = Date.parse('2026-11-25T12:00:00Z');

/** A launcher with a synthetic host driver and a tmux whose pane text the test controls. */
export function quotaHost(root: string, launch: { codexPausedUntil?: string } = {}) {
	const database = new DatabaseSync(':memory:');
	const clock = { now: quotaClock };
	const config = writeConfig(root, launch);
	const runtime = new TrackerNativeRuntimeService(database, {
		...trackerNodeRuntime(config),
		now: () => clock.now,
		automaticEnabled: () => true
	});
	return {
		database,
		runtime,
		clock,
		screen: (text: string) => writeFileSync(join(root, 'screen'), text),
		tick: () => runtime.scheduler!.tick(new AbortController().signal),
		runs: () =>
			database.prepare('SELECT item_id, cli, state FROM runs ORDER BY queued_at, id').all(),
		queue(id: string, fields: Record<string, string> = {}) {
			runtime.store.appendLocal({
				itemId: id,
				fields: {
					title: 'Update the README wording',
					kind: 'task',
					status: 'open',
					project: 'Harness',
					auto: id,
					launch_source: 'manual',
					'note+': 'auto-launch requested on mac',
					computer: quotaNode,
					launch_target: quotaNode,
					...fields
				}
			});
		},
		async api(method: string, path: string, body?: object) {
			const response = await trackerNodeApi(
				new Request('http://tracker-fixture.invalid' + path, {
					method,
					body: body && JSON.stringify(body)
				}),
				runtime,
				{ status: () => ({ autolaunch: {} }) } as unknown as TrackerSupervisorService,
				'fixture'
			);
			return { status: response.status, body: await response.json() };
		}
	};
}

function writeConfig(root: string, extra: { codexPausedUntil?: string }) {
	const driver = join(root, 'driver');
	const tmux = join(root, 'tmux-fixture');
	const syncSecretFile = join(root, 'secret');
	const config = join(root, 'node.json');
	writeFileSync(driver, `#!${process.execPath}\n${driverProgram}`, { mode: 0o700 });
	writeFileSync(tmux, `#!${process.execPath}\n${tmuxProgram}`, { mode: 0o700 });
	writeFileSync(syncSecretFile, 'synthetic-quota-wire-key', { mode: 0o600 });
	writeFileSync(
		config,
		JSON.stringify({
			version: 1,
			node: quotaNode,
			role: 'hub',
			apiPort: 49292,
			syncPort: 49293,
			database: join(root, 'db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile,
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				watchdog: { tmux },
				launch: {
					driver,
					maxConcurrent: 8,
					repositories: { Harness: { repo: root, platform: 'linux' } },
					...extra
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(config);
}

const driverProgram = `
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const file = require('node:path').join(__dirname, 'sessions');
const sessions = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
if (process.argv[2] === 'inspect') process.stdout.write(JSON.stringify(sessions));
else {
	const { itemId, key, queuedAt } = input;
	const session = { itemId, key, id: 'synthetic-' + itemId, state: 'live', startedAt: queuedAt,
		tmux: 'auto-' + itemId.slice(0, 6) + '-r' + (sessions.length + 1) };
	fs.writeFileSync(file, JSON.stringify([...sessions, session]));
	process.stdout.write(JSON.stringify({ status: 'started', session }));
}
`;

const tmuxProgram = `
const fs = require('node:fs');
const path = require('node:path');
const [,,, socket, command, ...args] = process.argv;
if (socket !== 'default') process.exit(2);
const file = path.join(__dirname, 'sessions');
const sessions = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const row = (session, index) => [session.tmux, ${quotaClock / 1000}, 71, '%' + (index + 1), 200 + index,
	${quotaClock / 1000}, 2, 2, 0, 0, 0, 0, 1, 1, 'claude'].join('|');
if (command === 'list-panes') process.stdout.write(sessions.map(row).join('\\n') + '\\n');
else if (command === 'display-message' && args.includes('-t')) {
	const index = Number(args[args.indexOf('-t') + 1].slice(1)) - 1;
	process.stdout.write(args.at(-1).includes('pane_current_path') ? __dirname + '\\n' : row(sessions[index], index) + '\\n');
} else if (command === 'capture-pane') {
	const screen = path.join(__dirname, 'screen');
	process.stdout.write(fs.existsSync(screen) ? fs.readFileSync(screen, 'utf8') : 'Working\\n');
} else process.exit(2);
`;
