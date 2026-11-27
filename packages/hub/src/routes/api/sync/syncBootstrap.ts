import type {
	SealedChainState,
	SealedDevicePublic
} from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { BootstrapState } from './syncBootstrap.types';
import type { Grant } from './syncGrants.types';
import type { SyncCall } from './syncPolicy.types';
import { sealedChain } from '../../../../../remote/src/utils/networking-security/sealedChain';
import { fromBase64Url } from './syncBase64';
import { isEntry } from './syncChain';
import { asGrant } from './syncGrants';
import { isDeviceId, readSyncJson, syncJson, syncProblem } from './syncHttp';
import { recoveryBlob } from './syncRecovery';
import { isScopeId } from './syncScope';

const grantLimit = 32;

/** Recoverable genesis publishes the signed entry, every grant and the recovery blob together. */
export async function bootstrap(call: SyncCall): Promise<Response> {
	const state = await parseBootstrap(call, await readSyncJson(call.request, 32 * 1024));
	if (!state) return syncProblem(400, 'invalid-bootstrap');
	try {
		await publish(call, state);
		return syncJson({ seq: 0, hash: state.hash }, 201);
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes('UNIQUE constraint failed'))
			throw error;
		return retry(call, state);
	}
}

export async function readRecovery(call: SyncCall): Promise<Response> {
	const recovery = await recoveryBlob(call);
	return recovery === null ? syncProblem(404, 'not-found') : syncJson({ recovery });
}

async function parseBootstrap(call: SyncCall, value: unknown): Promise<BootstrapState | null> {
	if (!value || typeof value !== 'object' || Object.keys(value).length !== 3) return null;
	const { entry, recovery, grants } = value as Record<string, unknown>;
	if (!isEntry(entry) || entry.by !== call.device || entry.body.type !== 'genesis') return null;
	if (typeof recovery !== 'string' || recovery.length > 2048) return null;
	if ((fromBase64Url(recovery)?.length ?? 0) <= 44) return null;
	if (!Array.isArray(grants) || grants.length > grantLimit) return null;
	try {
		const chain = await sealedChain([entry], { account: call.account });
		const wrapped = validateGrants(call, chain, grants);
		return wrapped ? { entry, hash: chain.head, recovery, grants: wrapped } : null;
	} catch {
		return null;
	}
}

function publicPoint(value: string): boolean {
	const bytes = fromBase64Url(value);
	return bytes?.length === 65 && bytes[0] === 4;
}

function validDevice(device: SealedDevicePublic, scopes: string[]): boolean {
	return (
		isDeviceId(device.deviceId) &&
		publicPoint(device.kemPublic) &&
		publicPoint(device.signingPublic) &&
		device.scopes.length === scopes.length &&
		new Set(device.scopes).size === scopes.length
	);
}

function validateGrants(call: SyncCall, chain: SealedChainState, raw: unknown[]): Grant[] | null {
	const devices = Object.values(chain.devices);
	const scopes = Object.keys(chain.scopes);
	if (devices.length !== 2 || !devices.some(({ role }) => role === 'recovery')) return null;
	if (scopes.length === 0 || scopes.length * devices.length !== raw.length) return null;
	if (!devices.every((device) => validDevice(device, scopes))) return null;
	if (
		!scopes.every(
			(scope) =>
				isScopeId(scope) && fromBase64Url(chain.scopes[scope].commitments[0])?.length === 32
		)
	)
		return null;
	const grants: Grant[] = [];
	const covered = new Set<string>();
	for (const value of raw) {
		const grant = asGrant(value, call.account);
		if (!grant || grant.epoch !== 0 || !chain.devices[grant.device]?.scopes.includes(grant.scope))
			return null;
		if (!publicPoint(grant.enc) || fromBase64Url(grant.ct)?.length !== 80) return null;
		covered.add(grant.device + '/' + grant.scope);
		grants.push(grant);
	}
	return covered.size === grants.length ? grants : null;
}

function publish(call: SyncCall, state: BootstrapState) {
	const { db, now } = call.deps;
	const { account } = call;
	const { entry, hash, recovery, grants } = state;
	const genesis = db
		.prepare(
			'INSERT INTO sealed_chain (account, seq, hash, entry, created_at) VALUES (?, 0, ?, ?, ?)'
		)
		.bind(account, hash, JSON.stringify(entry), now);
	const backup = db
		.prepare('INSERT INTO sealed_recoveries (account, recovery) VALUES (?, ?)')
		.bind(account, recovery);
	const insert = db.prepare(
		'INSERT INTO sealed_grants (account, scope, epoch, device, grant_body, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	);
	return db.batch([
		genesis,
		backup,
		...grants.map((item) =>
			insert.bind(account, item.scope, item.epoch, item.device, JSON.stringify(item), now)
		)
	]);
}

async function retry(call: SyncCall, state: BootstrapState): Promise<Response> {
	const conflict = () => syncProblem(409, 'chain-conflict');
	const { db } = call.deps;
	const hash = await db
		.prepare('SELECT hash FROM sealed_chain WHERE account = ? AND seq = 0')
		.bind(call.account)
		.first<string>('hash');
	if (hash !== state.hash || (await recoveryBlob(call)) !== state.recovery) return conflict();
	const statement = db.prepare(
		'SELECT grant_body FROM sealed_grants WHERE account = ? AND scope = ? AND epoch = ? AND device = ?'
	);
	const grants = await Promise.all(
		state.grants.map(({ scope, epoch, device }) =>
			statement.bind(call.account, scope, epoch, device).first<string>('grant_body')
		)
	);
	if (grants.some((grant, index) => grant !== JSON.stringify(state.grants[index])))
		return conflict();
	return syncJson({ seq: 0, hash });
}
