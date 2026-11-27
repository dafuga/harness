// @harness-uid u_jkomno4o5u
import type {
	TrackerHubOperation,
	TrackerHubOptions,
	TrackerHubStore,
	TrackerWireValue,
	TrackerWireObject
} from '../TrackerHubSyncService.types';
import { trackerHubResponse } from './hubHttp';
import { TrackerHubInputError } from './TrackerHubInputError';

export function receiveJournalPush(store: TrackerHubStore, body: string): Response {
	const { ops } = parseBody(body);
	const applied = store.applyOps(Array.isArray(ops) ? ops.map(parseOperation) : []);
	return trackerHubResponse(200, { ok: true, applied, db_id: store.dbId, last: store.maxSeq() });
}

export function grantDuePermission(
	options: TrackerHubOptions,
	body: string,
	peer: string,
	automatic = false
): Response {
	if (automatic) return trackerHubResponse(200, { allowed: options.permitAutomatic?.() === true });
	const { id, token } = parseBody(body);
	const allowed =
		typeof id === 'string' &&
		typeof token === 'string' &&
		options.permitDue?.(id, token, peer) === true;
	return trackerHubResponse(200, { allowed });
}

export function recordFleetTelemetry(
	options: TrackerHubOptions,
	body: string,
	peer: string
): Response {
	const { machines } = options;
	const runStore = options.runs?.();
	if (!machines && !runStore)
		return trackerHubResponse(404, { error: 'machine tracking disabled on the hub' });
	const { sample, runs } = parseBody(body);
	recordMachineSample(machines, sample, peer);
	if (runStore && Array.isArray(runs)) runStore.importRemote(peer, runs);
	return trackerHubResponse(200, {
		ok: true,
		machines: machines?.latestSamples() ?? [],
		...(runStore ? { run_history: runStore.historyRowsFor(peer) } : {})
	});
}

function recordMachineSample(
	machines: TrackerHubOptions['machines'],
	sample: TrackerWireValue | undefined,
	peer: string
): void {
	if (!sample) return;
	if (!isRecord(sample)) throw new TrackerHubInputError(400, 'malformed machine sample');
	machines?.record({ ...sample, node: peer });
}

export function parseBody(body: string): TrackerWireObject {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new TrackerHubInputError(400, 'invalid JSON body');
	}
	if (!isRecord(parsed)) throw new TrackerHubInputError(400, 'expected a JSON object');
	return parsed as TrackerWireObject;
}

function parseOperation(operation: unknown): TrackerHubOperation {
	if (
		!isRecord(operation) ||
		typeof operation.op_id !== 'string' ||
		typeof operation.item_id !== 'string' ||
		typeof operation.hlc !== 'string' ||
		typeof operation.node !== 'string'
	) {
		throw new TrackerHubInputError(400, 'malformed op');
	}
	if (!isRecord(operation.fields)) throw new TrackerHubInputError(400, 'malformed op fields');
	if (operation.actor != null && typeof operation.actor !== 'string') {
		throw new TrackerHubInputError(400, 'malformed op actor');
	}
	return operation as unknown as TrackerHubOperation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
