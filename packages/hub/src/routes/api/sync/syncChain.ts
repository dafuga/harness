import type { ChainRow } from './syncChain.types';
import type { SyncCall } from './syncPolicy.types';
import { chainHash } from './syncChainHash';
import { queryNumber, readSyncJson, syncJson, syncProblem } from './syncHttp';

const entryBytes = 16 * 1024;
const pageSize = 200;

function isLink(entry: Record<string, unknown>): boolean {
	const prev = entry.prev;
	return (
		Number.isSafeInteger(entry.seq) &&
		(entry.seq as number) >= 0 &&
		typeof prev === 'string' &&
		(prev === '' || /^[0-9a-f]{64}$/.test(prev))
	);
}

export function isEntry(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const entry = value as Record<string, unknown>;
	const signed = typeof entry.by === 'string' && typeof entry.sig === 'string';
	return (
		isLink(entry) &&
		signed &&
		Number.isSafeInteger(entry.at) &&
		!!entry.body &&
		typeof entry.body === 'object'
	);
}

/** The signed device chain after `after` (default: all of it), oldest first. */
export async function readChain(call: SyncCall): Promise<Response> {
	const after = queryNumber(call.url, 'after', -1);
	if (after === null) return syncProblem(400, 'invalid-input');
	const rows = await call.deps.db
		.prepare(
			'SELECT seq, entry FROM sealed_chain WHERE account = ? AND seq > ? ORDER BY seq LIMIT ?'
		)
		.bind(call.account, after, pageSize + 1)
		.all<ChainRow>();
	const page = rows.results.slice(0, pageSize);
	const entries = page.map((row) => JSON.parse(row.entry) as unknown);
	return syncJson({
		entries,
		head: page.at(-1)?.seq ?? after,
		more: rows.results.length > pageSize
	});
}

/**
 * Appends one signed entry. The server checks the sequence number and the hash of the previous
 * entry and nothing else: the signature and the rules of the chain are for the devices.
 */
export async function appendChain(call: SyncCall): Promise<Response> {
	const entry = await readSyncJson(call.request, entryBytes);
	if (!isEntry(entry)) return syncProblem(400, 'invalid-input');
	const seq = entry.seq as number;
	if (seq === 0 && entry.prev !== '') return syncProblem(400, 'invalid-input');
	if (seq > 0 && entry.prev === '') return syncProblem(400, 'invalid-input');
	const hash = await chainHash(entry);
	try {
		const result = await call.deps.db
			.prepare(
				`INSERT INTO sealed_chain (account, seq, hash, entry, created_at)
				 SELECT ?1, ?2, ?3, ?4, ?5
				 WHERE (?2 = 0 AND NOT EXISTS (SELECT 1 FROM sealed_chain WHERE account = ?1))
				    OR EXISTS (SELECT 1 FROM sealed_chain WHERE account = ?1 AND seq = ?2 - 1 AND hash = ?6)`
			)
			.bind(call.account, seq, hash, JSON.stringify(entry), call.deps.now, entry.prev)
			.run();
		if (result.meta.changes !== 1) return syncProblem(409, 'chain-conflict');
	} catch {
		return syncProblem(409, 'chain-conflict');
	}
	return syncJson({ seq, hash }, 201);
}
