import type { ObjectRow, ObjectWrite, Upsert } from './syncObjects.types';
import type { SyncCall } from './syncPolicy.types';
import { pokeScope } from './syncAccount';
import { toBase64Url } from './syncBase64';
import { queryNumber, readSyncText, syncJson, syncProblem, syncText } from './syncHttp';
import { recordHeader } from './syncEnvelope';
import { isObjectId, isScopeId } from './syncScope';

const objectBytes = 4 * 1024 * 1024;
const inlineBytes = 32 * 1024;
const pageLimit = 200;

function r2Key(call: SyncCall, scope: string, id: string, revision: number): string {
	return `sealed/${call.account}/${scope}/${id}/${revision}`;
}

/** The address and the header of a write, or the answer that refuses it. */
async function parseWrite(call: SyncCall): Promise<ObjectWrite | Response> {
	const [, scope, id] = call.parts;
	if (!isScopeId(scope) || !isObjectId(id)) return syncProblem(400, 'invalid-input');
	const text = await readSyncText(call.request, Math.ceil((objectBytes * 4) / 3) + 4);
	if (text === null) return syncProblem(413, 'too-large');
	const header = recordHeader(text);
	if (!header || header.scope !== scope || header.objectId !== id || header.revision === null)
		return syncProblem(400, 'invalid-input');
	if (header.size > objectBytes) return syncProblem(413, 'too-large');
	return { scope, id, header: header as ObjectWrite['header'], text };
}

/**
 * Stores the newest revision of an object. The header must name the path's scope and object id;
 * an older or equal revision is refused. Small envelopes stay in D1, large ones go to R2.
 */
export async function putObject(call: SyncCall): Promise<Response> {
	const write = await parseWrite(call);
	if (write instanceof Response) return write;
	const { scope, id, header } = write;
	const stored = await call.deps.db
		.prepare(
			'SELECT revision, r2_key FROM sealed_objects WHERE account = ? AND scope = ? AND object_id = ?'
		)
		.bind(call.account, scope, id)
		.first<{ revision: number; r2_key: string | null }>();
	if (stored && stored.revision >= header.revision)
		return syncProblem(409, 'stale-revision', { revision: stored.revision });
	if (header.size > inlineBytes && !call.deps.bucket) return syncProblem(503, 'unavailable');
	const change = await commit(call, write);
	if (change === null) return syncProblem(409, 'stale-revision');
	if (stored?.r2_key) await call.deps.bucket?.delete(stored.r2_key);
	await pokeScope(call, scope, change, 'objects');
	return syncJson({ revision: header.revision, change }, 201);
}

/** Writes the envelope to R2 when it is large, then the row; a lost race removes the new R2 object. */
async function commit(call: SyncCall, write: ObjectWrite): Promise<number | null> {
	const { scope, id, header, text } = write;
	const large = header.size > inlineBytes;
	const key = large ? r2Key(call, scope, id, header.revision) : null;
	if (key) await call.deps.bucket?.put(key, header.bytes);
	const change = await upsert(call, {
		scope,
		id,
		revision: header.revision,
		size: header.size,
		key,
		text: large ? null : text
	});
	if (change === null && key) await call.deps.bucket?.delete(key);
	return change;
}

async function upsert(call: SyncCall, write: Upsert): Promise<number | null> {
	const result = await call.deps.db
		.prepare(
			`INSERT INTO sealed_objects
			   (account, scope, object_id, revision, size, r2_key, envelope, change, updated_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7,
			   (SELECT COALESCE(MAX(change), 0) + 1 FROM sealed_objects WHERE account = ?1 AND scope = ?2), ?8)
			 ON CONFLICT (account, scope, object_id) DO UPDATE SET
			   revision = excluded.revision, size = excluded.size, r2_key = excluded.r2_key,
			   envelope = excluded.envelope, change = excluded.change, updated_at = excluded.updated_at
			 WHERE excluded.revision > sealed_objects.revision
			 RETURNING change`
		)
		.bind(
			call.account,
			write.scope,
			write.id,
			write.revision,
			write.size,
			write.key,
			write.text,
			call.deps.now
		)
		.all<{ change: number }>();
	return result.results[0]?.change ?? null;
}

/** One object's newest envelope as base64url text, with its revision in a header. */
export async function getObject(call: SyncCall): Promise<Response> {
	const [, scope, id] = call.parts;
	if (!isScopeId(scope) || !isObjectId(id)) return syncProblem(400, 'invalid-input');
	const row = await call.deps.db
		.prepare(
			`SELECT object_id, revision, size, r2_key, envelope, change FROM sealed_objects
			 WHERE account = ? AND scope = ? AND object_id = ?`
		)
		.bind(call.account, scope, id)
		.first<ObjectRow>();
	if (!row) return syncProblem(404, 'not-found');
	const envelope = row.envelope ?? (await fromR2(call, row.r2_key));
	if (envelope === null) return syncProblem(404, 'not-found');
	return syncText(envelope, { 'X-Sealed-Revision': String(row.revision) });
}

async function fromR2(call: SyncCall, key: string | null): Promise<string | null> {
	const object = key && call.deps.bucket ? await call.deps.bucket.get(key) : null;
	return object ? toBase64Url(new Uint8Array(await object.arrayBuffer())) : null;
}

/** What changed in a scope since `after`: ids, revisions and sizes, never contents. */
export async function listObjects(call: SyncCall): Promise<Response> {
	const scope = call.parts[1];
	const after = queryNumber(call.url, 'after', 0);
	if (!isScopeId(scope) || after === null || after < 0) return syncProblem(400, 'invalid-input');
	const rows = await call.deps.db
		.prepare(
			`SELECT object_id, revision, size, change FROM sealed_objects
			 WHERE account = ? AND scope = ? AND change > ? ORDER BY change LIMIT ?`
		)
		.bind(call.account, scope, after, pageLimit + 1)
		.all<ObjectRow>();
	const page = rows.results.slice(0, pageLimit);
	return syncJson({
		objects: page.map((row) => ({
			id: row.object_id,
			revision: row.revision,
			size: row.size,
			change: row.change
		})),
		next: page.at(-1)?.change ?? after,
		more: rows.results.length > pageLimit
	});
}
