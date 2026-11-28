import type { SealedChainEntry } from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { SyncCall } from './syncPolicy.types';
import { sealedChain } from '../../../../../remote/src/utils/networking-security/sealedChain';
import { cryptoSource } from '../../../../../remote/src/utils/networking-security/remoteBytes';
import { fromBase64Url, toBase64Url } from './syncBase64';
import { readSyncJson, syncJson, syncProblem } from './syncHttp';
import { isRecoverableAccount } from './syncRecovery';
import { isScopeId } from './syncScope';

const windowMs = 30_000;
const maxEntries = 2048;
const label = 'harness/sealed/v1/session\0';
const utf8 = new TextEncoder();

export async function readAccountChain(db: D1Database, account: string) {
	const rows = await db
		.prepare('SELECT entry FROM sealed_chain WHERE account = ? ORDER BY seq LIMIT ?')
		.bind(account, maxEntries + 1)
		.all<{ entry: string }>();
	if (!rows.results.length) return null;
	if (rows.results.length > maxEntries)
		throw new TypeError('Device chain exceeds the verification limit');
	const entries = rows.results.map(({ entry }) => JSON.parse(entry) as SealedChainEntry);
	return sealedChain(entries, { account });
}

async function challengeFor(call: SyncCall, window: number): Promise<string> {
	const context = JSON.stringify([call.sessionHash, call.account, call.device, window]);
	const hash = await crypto.subtle.digest('SHA-256', utf8.encode(label + context));
	return toBase64Url(new Uint8Array(hash));
}

function windowOf(call: SyncCall): number {
	return Math.floor(call.deps.now / windowMs);
}

async function activeChain(call: SyncCall) {
	try {
		return await readAccountChain(call.deps.db, call.account);
	} catch {
		return syncProblem(409, 'chain-conflict');
	}
}

/** Google authentication alone reports the login stage. The challenge is bound to this session. */
export async function readDeviceSession(call: SyncCall): Promise<Response> {
	const chain = await activeChain(call);
	if (chain instanceof Response) return chain;
	if (!chain) return syncJson({ state: 'first-device' });
	const device = chain.devices[call.device];
	if (device?.role !== 'admin' || !device.active)
		return syncJson({ state: 'waiting-for-approval' });
	if (await sessionMatchesDevice(call)) return syncJson({ state: 'approved' });
	return syncJson({ state: 'proof-required', challenge: await challengeFor(call, windowOf(call)) });
}

async function sessionMatchesDevice(call: SyncCall): Promise<boolean> {
	const bound = await sessionBoundDevice(
		call.deps.db,
		call.sessionHash,
		call.account,
		call.deps.now
	);
	return bound === call.device;
}

export function sessionBoundDevice(
	db: D1Database,
	idHash: string,
	account: string,
	now: number
): Promise<string | null> {
	return db
		.prepare(
			`SELECT sealed_device_id FROM auth_sessions
			WHERE id_hash = ? AND actor_id = ? AND expires_at > ? AND revoked_at IS NULL`
		)
		.bind(idHash, account, now)
		.first<string>('sealed_device_id');
}

/** Recoverable accounts reserve the approval inbox, live connection and scoped data for enrolled devices. */
export async function requireApprovedAccess(call: SyncCall): Promise<Response | undefined> {
	const [area, scope] = call.parts;
	const scoped = area === 'ops' || area === 'objects';
	const inbox = area === 'enroll' && call.parts.length === 1 && call.request.method === 'GET';
	if (!scoped && !inbox && area !== 'live') return;
	if (!(await isRecoverableAccount(call))) return;
	if (scoped && !isScopeId(scope)) return syncProblem(400, 'invalid-input');
	return approvedDeviceAccess(call, scoped ? scope : undefined);
}

/** A mailbox claim or receipt requires the same approved Google session as the inbox. */
export async function requireEnrollmentApprover(
	call: SyncCall,
	requireBinding = false
): Promise<Response | undefined> {
	if (requireBinding || (await isRecoverableAccount(call))) return approvedDeviceAccess(call);
}

async function approvedDeviceAccess(call: SyncCall, scope?: string): Promise<Response | undefined> {
	if (!(await sessionMatchesDevice(call))) return syncProblem(403, 'device-approval-required');
	const chain = await activeChain(call);
	if (chain instanceof Response) return chain;
	const device = chain?.devices[call.device];
	if (!device?.active || device.role !== 'admin')
		return syncProblem(403, 'device-approval-required');
	if (scope === undefined) return;
	if (!device.scopes.includes(scope)) return syncProblem(403, 'scope-denied');
	if (call.request.method !== 'GET' && chain?.scopes[scope].stale)
		return syncProblem(409, 'scope-key-rotation-required');
}

/** Bind the session only while the chain still matches the one that approved the signing key. */
export async function bindDeviceSession(call: SyncCall): Promise<Response> {
	const proof = await readSyncJson(call.request, 512);
	const chain = await activeChain(call);
	if (chain instanceof Response) return chain;
	const device = chain?.devices[call.device];
	if (!chain || device?.role !== 'admin' || !device.active)
		return syncProblem(403, 'device-proof-denied');
	if (!(await verifyProof(call, proof, device.signingPublic)))
		return syncProblem(403, 'device-proof-denied');
	const updated = await call.deps.db
		.prepare(
			`
			UPDATE auth_sessions SET sealed_device_id = ?1
			WHERE id_hash = ?2 AND actor_id = ?3 AND expires_at > ?4 AND revoked_at IS NULL
			  AND (sealed_device_id IS NULL OR sealed_device_id = ?1)
			  AND ?5 = (SELECT hash FROM sealed_chain WHERE account = ?3 ORDER BY seq DESC LIMIT 1)
		`
		)
		.bind(call.device, call.sessionHash, call.account, call.deps.now, chain.head)
		.run();
	return updated.meta.changes === 1
		? syncJson({ state: 'approved' })
		: syncProblem(409, 'session-changed');
}

async function verifyProof(
	call: SyncCall,
	proof: unknown,
	signingPublic: string
): Promise<boolean> {
	if (!proof || typeof proof !== 'object' || Object.keys(proof).length !== 2) return false;
	const { challenge, signature } = proof as Record<string, unknown>;
	if (typeof challenge !== 'string' || typeof signature !== 'string') return false;
	const sig = fromBase64Url(signature);
	const point = fromBase64Url(signingPublic);
	if (sig?.length !== 64 || point?.length !== 65) return false;
	const window = windowOf(call);
	const accepted = await Promise.all([challengeFor(call, window), challengeFor(call, window - 1)]);
	if (!accepted.includes(challenge)) return false;
	try {
		const key = await crypto.subtle.importKey(
			'raw',
			cryptoSource(point),
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
		return await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			key,
			cryptoSource(sig),
			utf8.encode(label + challenge)
		);
	} catch {
		return false;
	}
}
