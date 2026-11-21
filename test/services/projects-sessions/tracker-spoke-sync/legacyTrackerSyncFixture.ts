import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { TrackerSyncAuthService } from '../../../../src/services/networking-security/TrackerSyncAuthService';
import type {
	TrackerSpokeOperation,
	TrackerSpokeTransport
} from '../../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import { fixtureSecret } from './trackerSpokeFixture';
import type { FixtureJournal, LegacyHandlerFactory } from './legacyTrackerSyncFixture.types';

// Source hash for Tracker 122e190a8564e5f931bcf3b0a9322155779248ef:src/sync.js.
const legacySyncHash = '6b1905aa94477d44bca8b35b4702356d3f66ea58d06613a943af2bbce328455f';
const legacyPath = process.env.TRACKER_LEGACY_SYNC_FIXTURE;

async function loadLegacyHandler(path: string): Promise<LegacyHandlerFactory> {
	const source = await readFile(path);
	if (createHash('sha256').update(source).digest('hex') !== legacySyncHash) {
		throw new Error('Expected the pinned Tracker 122e190 sync.js fixture');
	}
	const sourceUrl = `data:text/javascript;base64,${source.toString('base64')}`;
	const legacy = await import(/* @vite-ignore */ sourceUrl);
	return legacy.createHubHandler;
}

const legacyHandler = legacyPath ? await loadLegacyHandler(legacyPath) : undefined;

/** Invoke the pinned handler without a server, or model its push and pull replies on normal runs. */
export function legacyTrackerTransport(store: FixtureJournal, dbId: string): TrackerSpokeTransport {
	return legacyHandler
		? pinnedTransport(legacyHandler, store, dbId)
		: fixtureTransport(store, dbId);
}

function pinnedTransport(
	createHandler: LegacyHandlerFactory,
	store: FixtureJournal,
	dbId: string
): TrackerSpokeTransport {
	const handler = createHandler({ store: { ...store, dbId, on: () => {} }, secret: fixtureSecret });
	return async (request) => {
		const stream = Readable.from(request.body === undefined ? [] : [Buffer.from(request.body)]);
		const req = Object.assign(stream, {
			method: request.method,
			url: request.pathAndQuery,
			headers: request.headers
		});
		let status = 0;
		let json: unknown;
		await handler(req, {
			writeHead: (value) => {
				status = value;
			},
			end: (body) => {
				json = JSON.parse(body);
			}
		});
		if (status !== 200) throw new Error(`Pinned fixture returned HTTP ${status}`);
		return json;
	};
}

function fixtureTransport(store: FixtureJournal, dbId: string): TrackerSpokeTransport {
	const auth = new TrackerSyncAuthService(fixtureSecret);
	return async (request) => {
		if (!auth.verify(request, request.headers.authorization))
			throw new Error('Invalid fixture signature');
		if (request.method === 'POST' && request.pathAndQuery === '/sync/push') {
			const { ops } = JSON.parse(request.body ?? '') as { ops: TrackerSpokeOperation[] };
			return { ok: true, applied: store.applyOps(ops), db_id: dbId, last: store.maxSeq() };
		}
		const target = new URL(request.pathAndQuery, 'http://fixture.invalid');
		if (request.method !== 'GET' || target.pathname !== '/sync/pull')
			throw new Error('Unexpected fixture route');
		const since = Number(target.searchParams.get('since'));
		const ops = store.opsSince(since, 1000);
		const max = store.maxSeq();
		return {
			ops,
			last: ops.at(-1)?.seq ?? Math.min(since, max),
			max,
			db_id: dbId,
			hub: store.node
		};
	};
}
