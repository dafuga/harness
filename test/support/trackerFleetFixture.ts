import { TrackerSpokeSyncService } from '../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerWireValue } from '../../src/services/projects-sessions/TrackerHubSyncService.types';
import { DatabaseSync } from 'node:sqlite';
import { nativeTrackerArgs } from '../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { formatNativeTrackerInspection } from '../../src/commands/projects-sessions/tracker-command/formatNativeTrackerInspection';
import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerNativeRuntimeOptions } from '../../src/services/projects-sessions/TrackerNativeRuntimeService.types';
import { trackerFleetMachineStore } from '../../src/services/projects-sessions/tracker-native-runtime-service/nativeTrackerLinks';
import type { Reading } from './trackerFleetFixture.types';
import { fixtureSecret, wire } from './trackerDispatchQueueFixture';
import { resourceSample, runnerReport } from './trackerMachineFixture';

export const hubNode = 'daniel-primary-mbp';
export const peerNode = 'harbor-mbp-2';
export const minute = 60_000;
export const signal = new AbortController().signal;

/** A hub and a spoke that report the readings each test sets, over the signed sync wire. */
export function fleet(extra: Partial<TrackerNativeRuntimeOptions> = {}) {
	const clock = { at: Date.parse('2026-11-26T12:00:00Z') };
	const readings: Record<string, Reading> = { [hubNode]: {}, [peerNode]: {} };
	const now = () => clock.at;
	const base = (node: string) => ({
		node,
		now,
		storage: { databaseId: () => `fixture-${node}` },
		machineSampler: { sample: async (at: number) => resourceSample(at, readings[node]) }
	});
	const hubDatabase = new DatabaseSync(':memory:');
	const peerDatabase = new DatabaseSync(':memory:');
	const hub = new TrackerNativeRuntimeService(hubDatabase, {
		...base(hubNode),
		role: 'hub',
		syncResponder: {
			auth: new TrackerSyncAuthService(fixtureSecret),
			machines: trackerFleetMachineStore()
		},
		...extra
	});
	const send = wire(hub.sync!);
	const peer = new TrackerNativeRuntimeService(peerDatabase, {
		...base(peerNode),
		role: 'spoke',
		links: [{ secret: fixtureSecret, transport: (request) => send(request), now }]
	});
	const tick = async () => {
		await hub.telemetry!(signal);
		await peer.telemetry!(signal);
	};
	const close = () => {
		hubDatabase.close();
		peerDatabase.close();
	};
	return { clock, readings, hub, peer, tick, close };
}

export async function call(runtime: TrackerNativeRuntimeService, args: string[]) {
	const { request, command } = nativeTrackerArgs(args);
	const response = await runtime.items.handle(
		new Request('http://tracker-fixture.invalid' + request.path, {
			method: request.method,
			body: JSON.stringify(request.body)
		})
	);
	const data = await response.json();
	return {
		status: response.status,
		data,
		text: response.ok ? (formatNativeTrackerInspection(command, data) ?? '') : ''
	};
}

export function originRun(runtime: TrackerNativeRuntimeService) {
	return Number(
		runtime.store.database
			.prepare(
				"INSERT INTO runs (item_id, rung, cli, model, state, queued_at, started_at) VALUES ('fixture', 'sol', 'codex', 'sol', 'running', 1, 1)"
			)
			.run().lastInsertRowid
	);
}

export function hostLease(
	runtime: TrackerNativeRuntimeService,
	method: 'POST' | 'DELETE',
	body: { run: number; lease: string; host: string; kind: string }
) {
	return runtime.items.handle(
		new Request('http://tracker-fixture.invalid/host-work', {
			method,
			body: JSON.stringify(body)
		})
	);
}

export function fleetReport(nodes: ReturnType<typeof fleet>, node: string, projects: string[]) {
	const at = nodes.clock.at;
	return {
		node,
		at: new Date(at).toISOString(),
		runner: runnerReport(at, projects),
		resources: resourceSample(at)
	};
}

/** Send one launcher report to the hub as the peer would. */
export async function exchangeFleetReport(
	nodes: ReturnType<typeof fleet>,
	sample: ReturnType<typeof fleetReport>
) {
	const client = new TrackerSpokeSyncService({
		store: nodes.peer.store,
		secret: fixtureSecret,
		transport: wire(nodes.hub.sync!)
	});
	await client.exchangeMachine(sample as unknown as TrackerWireValue, []);
}
