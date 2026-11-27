import type { OpRow } from './syncOps.types';
import type { SyncCall } from './syncPolicy.types';
import { pokeScope } from './syncAccount';
import { queryNumber, readSyncJson, syncJson, syncProblem } from './syncHttp';
import { recordHeader } from './syncEnvelope';
import { isScopeId } from './syncScope';

const bodyBytes = 1024 * 1024;
const envelopeBytes = 256 * 1024;
const batchLimit = 64;
const pageLimit = 200;
const pageBytes = 2 * 1024 * 1024;

/**
 * Appends sealed op-log entries to a scope. Each envelope's header must name this scope; its own
 * object id makes a retry harmless. The server numbers the entries and reads nothing else.
 */
export async function postOps(call: SyncCall): Promise<Response> {
	const scope = call.parts[1];
	const body = await readSyncJson(call.request, bodyBytes);
	if (!isScopeId(scope) || !Array.isArray(body) || body.length === 0 || body.length > batchLimit)
		return syncProblem(400, 'invalid-input');
	const headers = body.map((item) => (typeof item === 'string' ? recordHeader(item) : null));
	const bad = headers.some(
		(header) => !header || header.scope !== scope || header.size > envelopeBytes
	);
	if (bad) return syncProblem(400, 'invalid-input');
	const { db, now } = call.deps;
	const insert = db.prepare(
		`INSERT OR IGNORE INTO sealed_ops (account, scope, seq, op_id, device, received_at, envelope)
		 SELECT ?1, ?2, COALESCE(MAX(seq), 0) + 1, ?3, ?4, ?5, ?6
		 FROM sealed_ops WHERE account = ?1 AND scope = ?2`
	);
	const ids = headers.map((header) => header!.objectId);
	const lookup = db
		.prepare(
			`SELECT seq, op_id FROM sealed_ops WHERE account = ?1 AND scope = ?2
			 AND op_id IN (${ids.map((_, index) => `?${index + 3}`).join(', ')})`
		)
		.bind(call.account, scope, ...ids);
	const results = await db.batch([
		...body.map((envelope, index) =>
			insert.bind(call.account, scope, ids[index], call.device, now, envelope as string)
		),
		lookup
	]);
	const stored = (results.at(-1)?.results ?? []) as { seq: number; op_id: string }[];
	const bySeq = new Map(stored.map((row) => [row.op_id, row.seq]));
	if (ids.some((id) => !bySeq.has(id))) return syncProblem(503, 'try-again');
	const head = Math.max(...bySeq.values());
	await pokeScope(call, scope, head, 'ops');
	return syncJson({ ops: ids.map((id) => ({ opId: id, seq: bySeq.get(id) })), head }, 201);
}

/** The rows that fit in one page: at most the limit, and at most `pageBytes` of envelopes. */
function fitPage(rows: OpRow[]): OpRow[] {
	const ops: OpRow[] = [];
	let size = 0;
	for (const row of rows) {
		size += row.envelope.length;
		if (size > pageBytes && ops.length > 0) break;
		ops.push(row);
	}
	return ops;
}

/** Entries of a scope after `after`, oldest first, in pages of bounded size. */
export async function readOps(call: SyncCall): Promise<Response> {
	const scope = call.parts[1];
	const after = queryNumber(call.url, 'after', 0);
	const limit = queryNumber(call.url, 'limit', 100);
	if (!isScopeId(scope) || after === null || after < 0 || limit === null || limit < 1)
		return syncProblem(400, 'invalid-input');
	const wanted = Math.min(limit, pageLimit);
	const rows = await call.deps.db
		.prepare(
			`SELECT seq, op_id, device, received_at, envelope FROM sealed_ops
			 WHERE account = ? AND scope = ? AND seq > ? ORDER BY seq LIMIT ?`
		)
		.bind(call.account, scope, after, wanted + 1)
		.all<OpRow>();
	const ops = fitPage(rows.results.slice(0, wanted));
	return syncJson({
		ops: ops.map((row) => ({
			seq: row.seq,
			opId: row.op_id,
			device: row.device,
			receivedAt: row.received_at,
			envelope: row.envelope
		})),
		next: ops.at(-1)?.seq ?? after,
		more: ops.length < rows.results.length
	});
}
