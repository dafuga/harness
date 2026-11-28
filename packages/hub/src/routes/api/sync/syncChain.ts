import type { ChainRow } from './syncChain.types';
import type { SyncCall } from './syncPolicy.types';
import type { SealedChainEntry } from '../../../../../remote/src/models/networking-security/Sealed.types';
import { sealedChain } from '../../../../../remote/src/utils/networking-security/sealedChain';
import { queryNumber, readSyncJson, syncJson, syncProblem } from './syncHttp';
import { deviceWriteConflict } from './syncRecovery';

const entryBytes = 16 * 1024;
const pageSize = 200;
const maxChainEntries = 2048;

function isLink(entry: Record<string, unknown>): boolean {
	const prev = entry.prev;
	return (
		Number.isSafeInteger(entry.seq) &&
		(entry.seq as number) >= 0 &&
		typeof prev === 'string' &&
		(prev === '' || /^[0-9a-f]{64}$/.test(prev))
	);
}

export function isEntry(value: unknown): value is SealedChainEntry {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const entry = value as Record<string, unknown>;
	const signed = typeof entry.by === 'string' && typeof entry.sig === 'string';
	return (
		Object.keys(entry).length === 6 &&
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

/** Appends an account-bound entry signed by the device authorized by the existing chain. */
export async function appendChain(call: SyncCall): Promise<Response> {
	const entry = await readSyncJson(call.request, entryBytes);
	if (!isEntry(entry)) return syncProblem(400, 'invalid-input');
	const { seq } = entry;
	if (seq === 0 && entry.prev !== '') return syncProblem(400, 'invalid-input');
	if (seq > 0 && entry.prev === '') return syncProblem(400, 'invalid-input');
	const verified = await verifyAppend(call, entry);
	if (verified instanceof Response) return verified;
	const hash = verified;
	try {
		const result = await call.deps.db
			.prepare(
				`INSERT INTO sealed_chain (account, seq, hash, entry, created_at)
				 SELECT ?1, ?2, ?3, ?4, ?5
			 WHERE NOT EXISTS (SELECT 1 FROM sealed_recoveries WHERE account = ?1)
			   AND ((?2 = 0 AND NOT EXISTS (SELECT 1 FROM sealed_chain WHERE account = ?1))
			    OR EXISTS (SELECT 1 FROM sealed_chain WHERE account = ?1 AND seq = ?2 - 1 AND hash = ?6))`
			)
			.bind(call.account, seq, hash, JSON.stringify(entry), call.deps.now, entry.prev)
			.run();
		if (result.meta.changes !== 1) return deviceWriteConflict(call, 'chain-conflict');
	} catch {
		return deviceWriteConflict(call, 'chain-conflict');
	}
	return syncJson({ seq, hash }, 201);
}

async function verifyAppend(call: SyncCall, entry: SealedChainEntry): Promise<string | Response> {
	if (entry.by !== call.device) return syncProblem(400, 'invalid-chain');
	if (entry.seq >= maxChainEntries) return syncProblem(409, 'chain-conflict');
	const prefix = entry.seq === 0 ? [] : await readThrough(call, entry.seq);
	if (prefix.length !== entry.seq || (prefix.at(-1)?.hash ?? '') !== entry.prev)
		return syncProblem(409, 'chain-conflict');
	try {
		const entries = prefix.map((row) => JSON.parse(row.entry) as SealedChainEntry);
		const verified = await sealedChain([...entries, entry], { account: call.account });
		return verified.head;
	} catch {
		return syncProblem(400, 'invalid-chain');
	}
}

async function readThrough(call: SyncCall, seq: number) {
	const rows = await call.deps.db
		.prepare(
			'SELECT seq, hash, entry FROM sealed_chain WHERE account = ? AND seq <= ? ORDER BY seq'
		)
		.bind(call.account, seq)
		.all<ChainRow & { hash: string }>();
	return rows.results;
}
