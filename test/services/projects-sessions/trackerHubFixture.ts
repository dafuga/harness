import { expect, vi } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerHubSyncService } from '../../../src/services/projects-sessions/TrackerHubSyncService';
import type {
	TrackerHubJournalEntry,
	TrackerHubOperation,
	TrackerHubOptions,
	TrackerHubRequest
} from '../../../src/services/projects-sessions/TrackerHubSyncService.types';
import type { SignedHubInput } from './trackerHubFixture.types';

export const unit = 'service.projects-sessions-tracker-hub-sync';
export const timestamp = 1_700_000_000_000;
export const auth = new TrackerSyncAuthService('synthetic tracker hub key');
export const operation = {
	op_id: 'spoke:1',
	item_id: 'fixture-item',
	fields: { title: 'café ☕' },
	hlc: '001700000000000-000000-spoke',
	node: 'source-node',
	actor: 'fixture-actor',
	seq: 75
};

export function textStream(text: string): ReadableStream<Uint8Array> | null {
	return new Response(text).body;
}

export function signedRequest({
	method,
	path,
	text,
	node = 'fixture-spoke'
}: SignedHubInput): TrackerHubRequest {
	const authorization = auth.authorizationHeader(
		{ method, pathAndQuery: path, body: text },
		timestamp
	);
	const headers = new Headers({ authorization });
	if (node !== null) headers.set('x-tracker-node', node);
	return {
		method,
		pathAndQuery: path,
		headers,
		body: text === undefined ? null : textStream(text)
	};
}

export function hubFixture(options: Partial<TrackerHubOptions> = {}) {
	const journal: TrackerHubJournalEntry[] = [];
	const listeners = new Set<() => void>();
	const store = {
		node: 'fixture-hub',
		dbId: 'fixture-db',
		maxSeq: () => journal.length,
		opsSince: vi.fn((since: number, limit: number) =>
			journal.filter(({ seq }) => seq > since).slice(0, limit)
		),
		applyOps: vi.fn((operations: readonly TrackerHubOperation[]) => {
			const before = journal.length;
			for (const op of operations) {
				if (!journal.some(({ op_id }) => op_id === op.op_id))
					journal.push({ ...op, seq: journal.length + 1 });
			}
			if (before !== journal.length) for (const wake of listeners) wake();
			return journal.length - before;
		}),
		subscribe: vi.fn((listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		})
	};
	const hub = new TrackerHubSyncService({ auth, store, now: () => timestamp, ...options });
	return {
		hub,
		store,
		listeners,
		send: (input: SignedHubInput) => hub.handle(signedRequest(input))
	};
}

export async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
	expect(response.status).toBe(status);
	expect(response.headers.get('content-type')).toBe('application/json');
	const text = await response.text();
	expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(text)));
	expect(JSON.parse(text)).toStrictEqual(body);
}

export function pullPage(ops: readonly TrackerHubJournalEntry[], last: number, max: number) {
	return { ops, last, max, db_id: 'fixture-db', hub: 'fixture-hub' };
}
