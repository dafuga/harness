import type { Grant } from './syncGrants.types';
import type { SyncCall } from './syncPolicy.types';
import { fromBase64Url } from './syncBase64';
import { isDeviceId, readSyncJson, syncJson, syncProblem } from './syncHttp';
import { isScopeId } from './syncScope';
import { deviceWriteConflict } from './syncRecovery';

const bodyBytes = 64 * 1024;
const batchLimit = 32;
const readLimit = 500;

function sized(value: unknown, bytes: number | null, max: number): value is string {
	if (typeof value !== 'string' || value.length > max) return false;
	const decoded = fromBase64Url(value);
	return decoded !== null && (bytes === null ? decoded.length > 0 : decoded.length === bytes);
}

function isEpoch(value: unknown): boolean {
	return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
}

export function asGrant(value: unknown, account: string): Grant | null {
	if (!value || typeof value !== 'object') return null;
	const grant = value as Record<string, unknown>;
	const named = grant.account === account && isScopeId(grant.scope) && isDeviceId(grant.device);
	const sealed = isEpoch(grant.epoch) && sized(grant.enc, 65, 87) && sized(grant.ct, null, 256);
	if (!named || !sealed) return null;
	const { scope, epoch, device, enc, ct } = grant as unknown as Grant;
	return { account, scope, epoch, device, enc, ct };
}

/** Stores key grants. The first grant for a scope, epoch and device stays; the grant is opaque HPKE output. */
export async function putGrants(call: SyncCall): Promise<Response> {
	const body = await readSyncJson(call.request, bodyBytes);
	const list = Array.isArray(body) ? body : [body];
	const grants = list.map((item) => asGrant(item, call.account));
	if (!list.length || list.length > batchLimit || grants.some((grant) => grant === null))
		return syncProblem(400, 'invalid-input');
	const insert = call.deps.db.prepare(
		`INSERT OR IGNORE INTO sealed_grants (account, scope, epoch, device, grant_body, created_at)
		 SELECT ?1, ?2, ?3, ?4, ?5, ?6
		 WHERE NOT EXISTS (SELECT 1 FROM sealed_recoveries WHERE account = ?1)`
	);
	const results = await call.deps.db.batch(
		(grants as Grant[]).map((grant) =>
			insert.bind(
				call.account,
				grant.scope,
				grant.epoch,
				grant.device,
				JSON.stringify(grant),
				call.deps.now
			)
		)
	);
	const stored = results.reduce((sum, result) => sum + result.meta.changes, 0);
	return stored === 0 ? deviceWriteConflict(call) : syncJson({ stored }, 201);
}

/** Every grant written for a device, newest epoch last. */
export async function readGrants(call: SyncCall): Promise<Response> {
	const device = call.url.searchParams.get('device');
	if (!isDeviceId(device)) return syncProblem(400, 'invalid-input');
	const rows = await call.deps.db
		.prepare(
			`SELECT grant_body FROM sealed_grants WHERE account = ? AND device = ?
			 ORDER BY scope, epoch LIMIT ?`
		)
		.bind(call.account, device, readLimit)
		.all<{ grant_body: string }>();
	return syncJson({ grants: rows.results.map((row) => JSON.parse(row.grant_body) as unknown) });
}
