import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerNativeRuntimeOptions } from '../../src/services/projects-sessions/TrackerNativeRuntimeService.types';
import type { TrackerResourceScenario } from './trackerHostResourceFixture.types';

const now = Date.parse('2026-11-25T12:00:00Z');

export const healthyHost: TrackerResourceScenario = {
	cores: 10,
	load: [1, 1],
	availableMB: 32_000,
	freePercent: 80,
	freeGB: 500,
	freeInodes: 10_000_000,
	inodeFreePercent: 80
};

/** A driver-backed Tracker host whose resource readings the test controls. */
export function trackerResourceHost(root: string, node: string, limits: object = {}) {
	const host = { ...healthyHost };
	const database = new DatabaseSync(':memory:');
	const options = trackerNodeRuntime(resourceConfig(root, node, limits));
	const runtime = new TrackerNativeRuntimeService(database, {
		...options,
		hostEffects: { ...options.hostEffects, hostResources: scenarioResources(host) },
		now: () => now,
		automaticEnabled: () => true
	});
	return {
		host,
		database,
		runtime,
		queue(id: string, project: string) {
			runtime.store.appendLocal({
				itemId: id,
				fields: {
					title: id,
					kind: 'task',
					status: 'open',
					project,
					auto: `${id}-token`,
					launch_source: 'manual',
					'note+': `auto-launch requested on ${node}`,
					computer: node,
					launch_target: node
				}
			});
		},
		tick: () => runtime.scheduler!.tick(new AbortController().signal),
		waiting: () => runtime.scheduler!.runnerStatus().waiting_on,
		running: () =>
			database
				.prepare('SELECT item_id FROM runs ORDER BY id')
				.all()
				.map((row) => row.item_id),
		started: () => JSON.parse(readFileSync(join(root, 'started'), 'utf8'))
	};
}

/** Keep managed-launcher behavior tests independent of how busy the test computer is. */
export function onIdleHost(options: TrackerNativeRuntimeOptions): TrackerNativeRuntimeOptions {
	return {
		...options,
		hostEffects: { ...options.hostEffects, hostResources: idleHostResources() }
	};
}

export function idleHostResources() {
	return scenarioResources({ ...healthyHost });
}

export function idleNodeRuntime(config: Parameters<typeof trackerNodeRuntime>[0]) {
	return onIdleHost(trackerNodeRuntime(config));
}

function scenarioResources(host: TrackerResourceScenario) {
	return {
		cores: () => host.cores,
		load: () => host.load,
		memory: () => ({ availableMB: host.availableMB, freePercent: host.freePercent }),
		volume: () => {
			if (host.unreadableVolume) throw new Error('fixture volume unreadable');
			return {
				freeGB: host.freeGB,
				freeInodes: host.freeInodes,
				inodeFreePercent: host.inodeFreePercent
			};
		}
	};
}

function resourceConfig(root: string, node: string, limits: object) {
	const driver = join(root, 'driver');
	const syncSecretFile = join(root, 'secret');
	const config = join(root, 'node.json');
	writeFileSync(driver, `#!${process.execPath}\n${driverProgram}`, { mode: 0o700 });
	writeFileSync(syncSecretFile, 'synthetic-resource-wire-key', { mode: 0o600 });
	const mac = ['daniel-primary-mbp', 'harbor-mbp-2'].includes(node);
	const repository = { repo: root, platform: mac ? 'macos' : 'linux' };
	writeFileSync(
		config,
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
				launch: {
					driver,
					maxConcurrent: 8,
					repositories: { Harbor: repository, Harness: repository },
					...limits
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(config);
}

const driverProgram = `
const fs = require('node:fs');
const receipts = require('node:path').join(__dirname, 'sessions.json');
const sessions = fs.existsSync(receipts) ? JSON.parse(fs.readFileSync(receipts, 'utf8')) : [];
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (process.argv[2] !== 'start') process.stdout.write(JSON.stringify(sessions));
else {
	const { itemId, key, queuedAt } = input;
	const session = { itemId, key, id: 'synthetic-' + itemId, state: 'live', startedAt: queuedAt };
	fs.writeFileSync(receipts, JSON.stringify([...sessions, session]));
	fs.writeFileSync(require('node:path').join(__dirname, 'started'), JSON.stringify(input));
	process.stdout.write(JSON.stringify({ status: 'started', session }));
}
`;
