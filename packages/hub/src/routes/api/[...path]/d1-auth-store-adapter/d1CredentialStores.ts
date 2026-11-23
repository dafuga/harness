// @harness-uid u_nxgkfvplrk
import type { D1CredentialStores } from '../../../../utils/networking-security/d1CredentialStores';
import type { D1Like } from './D1AuthStoreAdapter';
import type { SessionStore } from '../../../../models/accounts-access/HubAuthStore.types';
import { DEVICE_ACTIVITY_INTERVAL } from '../../../../repositories/projects-sessions/SessionRepository';
import { accountDevice } from '../../../../validators/accounts-access/AuthRecordValidator';
import type { AuthRecordValidator } from '../../../../validators/accounts-access/AuthRecordValidator';

const SESSION_COLUMNS =
	'id_hash, kind, parent_hash, actor_id, actor_email, actor_name, resource, created_at, expires_at, revoked_at, device_id, device_name, last_seen_at';

function sessions(db: D1Like, records: AuthRecordValidator): SessionStore {
	return {
		async create(r) {
			const insert = `INSERT INTO auth_sessions (${SESSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
			const actor = [r.actor.id, r.actor.email, r.actor.name];
			const times = [r.createdAt, r.expiresAt, r.revokedAt];
			const device = r.device
				? [r.device.id, r.device.name, Date.parse(r.device.lastSeenAt)]
				: [null, null, null];
			await db
				.prepare(insert)
				.bind(r.idHash, r.kind, r.parentHash, ...actor, r.resource, ...times, ...device)
				.run();
		},
		async find(idHash) {
			const query = 'SELECT * FROM auth_sessions WHERE id_hash = ?';
			const row = await db.prepare(query).bind(idHash).first();
			return row ? records.session(row) : null;
		},
		async devices(actorId, now) {
			const query = `SELECT device_id, device_name, last_seen_at FROM auth_sessions
				WHERE actor_id = ? AND device_id IS NOT NULL AND revoked_at IS NULL AND expires_at > ?
				ORDER BY last_seen_at DESC, device_id LIMIT 100`;
			const { results } = await db.prepare(query).bind(actorId, now).all();
			return results.map(accountDevice);
		},
		async removeDevice(actorId, deviceId, now) {
			const query = `UPDATE auth_sessions SET revoked_at = ?
				WHERE actor_id = ? AND device_id = ? AND revoked_at IS NULL AND expires_at > ? RETURNING device_id`;
			return (await db.prepare(query).bind(now, actorId, deviceId, now).first()) !== null;
		},
		async touchDevice(idHash, now) {
			const query = `UPDATE auth_sessions SET last_seen_at = ?
				WHERE id_hash = ? AND revoked_at IS NULL AND last_seen_at <= ?`;
			await db
				.prepare(query)
				.bind(now, idHash, now - DEVICE_ACTIVITY_INTERVAL)
				.run();
		},
		async revoke(idHash, now) {
			const update =
				'UPDATE auth_sessions SET revoked_at = ? WHERE (id_hash = ? OR parent_hash = ?) AND revoked_at IS NULL';
			await db.prepare(update).bind(now, idHash, idHash).run();
		}
	};
}

export function d1CredentialStores(db: D1Like, records: AuthRecordValidator): D1CredentialStores {
	return { sessions: sessions(db, records) };
}
