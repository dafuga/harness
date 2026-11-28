import type { SealedChainEntry } from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { ChainRow } from './syncChain.types';
import type { DeviceChange } from './syncDevices.types';
import type { SyncCall } from './syncPolicy.types';
import { sealedChain } from '../../../../../remote/src/utils/networking-security/sealedChain';
import { chainEntryHash } from '../../../../../remote/src/utils/networking-security/sealedChainEntry';
import { isEntry } from './syncChain';
import { asGrant } from './syncGrants';
import { fromBase64Url } from './syncBase64';
import { readSyncJson, syncJson, syncProblem } from './syncHttp';
import { matchesDeviceChange } from './syncDeviceGrants';
import { askAccount } from './syncAccount';
import { requireEnrollmentApprover } from './syncDeviceSession';
import { isEnrollmentId } from './syncEnroll';

const maxHistory = 2048;
const maxStatements = 96;

function readChange(value: unknown, call: SyncCall): DeviceChange | null {
	if (!value || typeof value !== 'object') return null;
	const { entries, grants, enrollment } = value as Record<string, unknown>;
	if (enrollment !== undefined && !isEnrollmentId(enrollment)) return null;
	if (!Array.isArray(entries) || !entries.length || !Array.isArray(grants)) return null;
	if (entries.length + grants.length > maxStatements) return null;
	if (
		!entries.every(
			(entry) => isEntry(entry) && Object.keys(entry).length === 6 && entry.by === call.device
		)
	)
		return null;
	const wrapped = grants.map((grant) => asGrant(grant, call.account));
	if (
		wrapped.some(
			(grant) =>
				!grant || fromBase64Url(grant.ct)?.length !== 80 || fromBase64Url(grant.enc)?.[0] !== 4
		)
	)
		return null;
	return {
		entries: entries as SealedChainEntry[],
		grants: wrapped as DeviceChange['grants'],
		enrollment
	};
}

/** Publishes an existing admin's signed change and HPKE grants in a single D1 transaction. */
export async function changeDevices(call: SyncCall): Promise<Response> {
	const change = readChange(await readSyncJson(call.request, 256 * 1024), call);
	if (!change) return syncProblem(400, 'invalid-input');
	const stored = await deviceHistory(call);
	if (!stored) return syncProblem(409, 'chain-too-long');
	const start = change.entries[0].seq;
	const lastStart = Math.min(stored.length, maxHistory - change.entries.length);
	if (start <= 0 || start > lastStart) return syncProblem(409, 'chain-conflict');
	const head = await verifyDeviceChange(call, change, stored.slice(0, start));
	if (head instanceof Response) return head;
	if (change.enrollment) {
		const denied = await reserveEnrollment(call, change, head.hash);
		if (denied) return denied;
	}
	if (start < stored.length) return retry(call, change, stored, head);
	return publish(call, change, head);
}

async function deviceHistory(call: SyncCall): Promise<SealedChainEntry[] | null> {
	const rows = await call.deps.db
		.prepare('SELECT seq, entry FROM sealed_chain WHERE account = ? ORDER BY seq LIMIT ?')
		.bind(call.account, maxHistory + 1)
		.all<ChainRow>();
	if (rows.results.length > maxHistory) return null;
	return rows.results.map(({ entry }) => JSON.parse(entry) as SealedChainEntry);
}

async function verifyDeviceChange(
	call: SyncCall,
	change: DeviceChange,
	prefix: SealedChainEntry[]
) {
	try {
		const account = { account: call.account };
		const before = await sealedChain(prefix, account);
		if (change.entries[0].prev !== before.head) return syncProblem(409, 'chain-conflict');
		const after = await sealedChain([...prefix, ...change.entries], account);
		if (!matchesDeviceChange(change, before, after, call.device))
			return syncProblem(400, 'invalid-change');
		return { seq: after.seq, hash: after.head };
	} catch {
		return syncProblem(400, 'invalid-change');
	}
}

async function reserveEnrollment(call: SyncCall, change: DeviceChange, hash: string) {
	const [entry] = change.entries;
	if (change.entries.length !== 1 || entry.body.type !== 'enroll')
		return syncProblem(400, 'invalid-change');
	const refusal = await requireEnrollmentApprover(call, true);
	if (refusal) return refusal;
	const { deviceId: recipient, kemPublic, signingPublic } = entry.body.device;
	const reserved = await askAccount(call, '/enroll/' + change.enrollment, {
		method: 'POST',
		body: JSON.stringify({
			by: call.device,
			body: '{}',
			decision: { kind: 'publish', hash, recipient, kemPublic, signingPublic }
		})
	});
	if (!reserved) return syncProblem(503, 'unavailable');
	await reserved.body?.cancel();
	if (!reserved.ok) return syncProblem(409, 'enrollment-unavailable');
}

async function retry(
	call: SyncCall,
	change: DeviceChange,
	stored: SealedChainEntry[],
	head: { seq: number; hash: string }
): Promise<Response> {
	const last = stored[head.seq];
	if (!last || (await chainEntryHash(last)) !== head.hash)
		return syncProblem(409, 'chain-conflict');
	const owned = await Promise.all(
		change.grants.map(async ({ scope, epoch, device }) =>
			call.deps.db
				.prepare(
					'SELECT grant_body FROM sealed_grants WHERE account = ? AND scope = ? AND epoch = ? AND device = ?'
				)
				.bind(call.account, scope, epoch, device)
				.first<string>('grant_body')
		)
	);
	if (owned.some((grant, index) => grant !== JSON.stringify(change.grants[index])))
		return syncProblem(409, 'chain-conflict');
	return syncJson(head);
}

async function publish(
	call: SyncCall,
	change: DeviceChange,
	head: { seq: number; hash: string }
): Promise<Response> {
	const { db, now } = call.deps;
	const chain = db.prepare(
		'INSERT INTO sealed_chain (account, seq, hash, entry, created_at) VALUES (?, ?, ?, ?, ?)'
	);
	const grant = db.prepare(
		'INSERT INTO sealed_grants (account, scope, epoch, device, grant_body, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	);
	const entries = await Promise.all(
		change.entries.map(async (entry) =>
			chain.bind(call.account, entry.seq, await chainEntryHash(entry), JSON.stringify(entry), now)
		)
	);
	const grants = change.grants.map((item) =>
		grant.bind(call.account, item.scope, item.epoch, item.device, JSON.stringify(item), now)
	);
	try {
		await db.batch([...entries, ...grants]);
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes('UNIQUE constraint failed'))
			throw error;
		return syncProblem(409, 'chain-conflict');
	}
	return syncJson(head, 201);
}
