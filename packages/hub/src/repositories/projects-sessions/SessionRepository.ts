// @harness-uid u_znrbtnptwg
import type {
	SessionRepositoryOptions,
	SessionGrant,
	IssuedSession
} from './SessionRepository.types';
import type { SessionRecord } from '../../models/accounts-access/HubAuthStore.types';
import { randomToken } from '../../utils/verification-evidence/authSecrets';

export const BROWSER_TTL = 7 * 24 * 60 * 60 * 1000;
export const DEVICE_ACTIVITY_INTERVAL = 5 * 60 * 1000;
export const NATIVE_TTL = 30 * 24 * 60 * 60 * 1000;

/** Opaque, server-revocable sessions. A credential is random bytes, never a signed claim set. */
export class SessionRepository {
	constructor(private readonly options: SessionRepositoryOptions) {}

	async issue(grant: SessionGrant): Promise<IssuedSession> {
		const credential = randomToken();
		const createdAt = this.options.now();
		const { deviceName, ...scope } = grant;
		const device =
			grant.kind === 'native'
				? {
						id: randomToken(),
						name: deviceName ?? 'Harness device',
						lastSeenAt: new Date(createdAt).toISOString()
					}
				: undefined;
		const record: SessionRecord = {
			...scope,
			...(device ? { device } : {}),
			idHash: await this.options.secrets.hash('session', credential),
			createdAt,
			expiresAt: createdAt + (grant.kind === 'native' ? NATIVE_TTL : BROWSER_TTL),
			revokedAt: null
		};
		await this.options.store.create(record);
		return { credential, record };
	}

	/** The live session for a credential. Null once it is unknown, expired or revoked. */
	async find(credential: string): Promise<SessionRecord | null> {
		const record = await this.live(await this.options.secrets.hash('session', credential));
		const now = this.options.now();
		if (record?.device && now - Date.parse(record.device.lastSeenAt) >= DEVICE_ACTIVITY_INTERVAL) {
			await this.options.store.touchDevice(record.idHash, now);
		}
		return record;
	}

	async live(idHash: string): Promise<SessionRecord | null> {
		const record = await this.options.store.find(idHash);
		if (!record || record.revokedAt !== null) return null;
		return record.expiresAt > this.options.now() ? record : null;
	}

	devices(actorId: string) {
		return this.options.store.devices(actorId, this.options.now());
	}

	removeDevice(actorId: string, deviceId: string) {
		return this.options.store.removeDevice(actorId, deviceId, this.options.now());
	}

	/** Ends the session and every native session it approved. */
	async revoke(record: SessionRecord): Promise<void> {
		await this.options.store.revoke(record.idHash, this.options.now());
	}

	/** Ends every session issued from this origin, such as a pending email proof. */
	async revokeIssuedFrom(parentHash: string): Promise<void> {
		await this.options.store.revoke(parentHash, this.options.now());
	}
}

export type {
	SessionRepositoryOptions,
	SessionGrant,
	IssuedSession
} from './SessionRepository.types';
