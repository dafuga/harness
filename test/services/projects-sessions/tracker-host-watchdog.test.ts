import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { trackerNodeApi } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const itemId = 'abc123def4';
const node = 'daniel-primary-mbp';
const minute = 60_000;
const firstPoll = 1_800_000_000_000;

test('journals one idle nudge, escalates a stale pane and forwards its alert once to the primary CoS', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'host-watchdog-escalation',
		() => withTempDir('hnt-watch-', proveWatchdog)
	));

async function proveWatchdog(root: string) {
	let clock = firstPoll;
	const executable = join(root, 'watchdog');
	const trace = join(root, 'effects.ndjson');
	writeFileSync(executable, `#!${process.execPath}\n${watchdogDriver}`, { mode: 0o700 });
	const db = new DatabaseSync(':memory:');
	const create = () =>
		new TrackerNativeRuntimeService(db, {
			node,
			role: 'hub',
			now: () => clock,
			hostEffects: { watchdog: { driver: executable, chiefOfStaff: true } }
		});
	const runtime = create();
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Synthetic task',
			status: 'in_progress',
			kind: 'task'
		}
	});
	const signal = new AbortController().signal;
	try {
		await measureWorkload('command.projects-sessions-tracker', 'native-watchdog-read', () =>
			assertDryRun(runtime, trace)
		);
		await runtime.watchdog!.tick(signal);
		expect(runtime.watchdog!.alerts()).toEqual([]);
		clock += 11 * minute;
		const restarted = create();
		await restarted.watchdog!.tick(signal);
		await restarted.watchdog!.tick(signal);
		await verifyAlert(restarted);
		const effects = readFileSync(trace, 'utf8')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(effects).toMatchObject([
			{ operation: 'watchdog-nudge', itemId, pane: { key: 'synthetic-pane' } },
			{ operation: 'watchdog-cos', alerts: [{ item_id: itemId, host: node }] }
		]);
	} finally {
		db.close();
	}
}

async function assertDryRun(runtime: TrackerNativeRuntimeService, trace: string) {
	const request = nativeTrackerArgs(['watchdog', 'dry-run', '--item', 'abc123']).request;
	expect(request).toEqual({ method: 'GET', path: '/watchdog/dry-run?item=abc123' });
	const response = await trackerNodeApi(
		new Request('http://tracker-fixture.invalid' + request.path),
		runtime,
		new TrackerSupervisorService(runtime),
		'synthetic-fence'
	);
	expect(await response.json()).toMatchObject({
		available: true,
		sessions: [{ id: itemId, action: 'nudge' }]
	});
	expect(existsSync(trace)).toBe(false);
}

async function verifyAlert(runtime: TrackerNativeRuntimeService) {
	const response = await trackerNodeApi(
		new Request('http://tracker-fixture.invalid/watchdog/alerts'),
		runtime,
		new TrackerSupervisorService(runtime),
		'synthetic-fence'
	);
	expect(await response.json()).toMatchObject([{ item_id: itemId, host: node, kind: 'idle' }]);
	const item = await runtime.items.handle(
		new Request('http://tracker-fixture.invalid/items/' + itemId)
	);
	expect(await item.json()).toMatchObject({
		needs_daniel: true,
		notes_log: [
			{ text: expect.stringContaining('watchdog nudge 1/1') },
			{ text: expect.stringContaining('watchdog idle') }
		]
	});
}

const watchdogDriver = `
const { appendFileSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const operation = process.argv[2];
const input = JSON.parse(readFileSync(0, 'utf8'));
const result = operation === 'watchdog-scan' ? [{
  name: 'auto-abc123', key: 'synthetic-pane', activity: ${firstPoll - 11 * minute}, createdAt: ${firstPoll - 12 * minute},
  live: true, runnerSocket: true, readable: true, ready: true, attached: false, x: 2, y: 2,
  currentCommand: 'codex', screen: 'fixture\\n\\n› \\n\\n100% context left\\n'
}] : { sent: true };
if (operation !== 'watchdog-scan') {
	appendFileSync(join(dirname(process.argv[1]), 'effects.ndjson'), JSON.stringify({ operation, ...input }) + '\\n');
}
process.stdout.write(JSON.stringify(result));
`;
