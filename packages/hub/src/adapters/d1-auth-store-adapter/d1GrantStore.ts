import { ERASE } from '../../utils/d1GrantStore';
import type { D1Like } from "./D1AuthStoreAdapter";
import type { GithubGrantRecord, GrantLease, GrantStore } from "../../models/HubAuthStore.types.ts";
import type { AuthRecordValidator } from "../../validators/AuthRecordValidator";

const COLUMNS =
	'actor_id, github_user_id, login, token_cipher, token_expires_at, refresh_cipher, refresh_expires_at, created_at, expires_at, generation, revoked_at, refreshing_until';

const PUBLISH =
	'github_user_id = excluded.github_user_id, login = excluded.login, token_cipher = excluded.token_cipher, token_expires_at = excluded.token_expires_at, refresh_cipher = excluded.refresh_cipher, refresh_expires_at = excluded.refresh_expires_at, created_at = excluded.created_at, expires_at = excluded.expires_at, generation = excluded.generation, revoked_at = NULL, refreshing_until = NULL';

const HELD = 'actor_id = ? AND generation = ? AND revoked_at IS NULL AND refreshing_until = ?';

/**
 * Compare-and-swap in one statement. A row is offered only when the caller expects none
 * (`expected = 0`) or one exists, and an existing row is replaced only at the expected generation.
 */
const CONNECT = `INSERT INTO auth_github_grants (${COLUMNS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? + 1, NULL, NULL WHERE ? = 0 OR EXISTS (SELECT 1 FROM auth_github_grants WHERE actor_id = ?) ON CONFLICT(actor_id) DO UPDATE SET ${PUBLISH} WHERE auth_github_grants.generation = ? RETURNING generation`;

const LEASE =
	'UPDATE auth_github_grants SET refreshing_until = ? WHERE actor_id = ? AND generation = ? AND revoked_at IS NULL AND expires_at > ? AND (refreshing_until IS NULL OR refreshing_until <= ?) RETURNING generation';

const ROTATE = `UPDATE auth_github_grants SET github_user_id = ?, login = ?, token_cipher = ?, token_expires_at = ?, refresh_cipher = ?, refresh_expires_at = ?, refreshing_until = NULL WHERE ${HELD} RETURNING generation`;

const REVOKE = `INSERT INTO auth_github_grants (${COLUMNS}) VALUES (?, 0, '', '', NULL, NULL, NULL, ?, ?, 1, ?, NULL) ON CONFLICT(actor_id) DO UPDATE SET ${ERASE}, generation = auth_github_grants.generation + 1, revoked_at = excluded.revoked_at`;

const REVOKE_LEASED = `UPDATE auth_github_grants SET ${ERASE}, generation = generation + 1, revoked_at = ? WHERE ${HELD} RETURNING generation`;

function tokens(record: GithubGrantRecord): (string | number | null)[] {
	const { githubUserId, login, tokenCipher, tokenExpiresAt, refreshCipher, refreshExpiresAt } =
		record;
	return [githubUserId, login, tokenCipher, tokenExpiresAt, refreshCipher, refreshExpiresAt];
}

function held(lease: GrantLease): (string | number)[] {
	return [lease.actorId, lease.generation, lease.until];
}

export function d1GrantStore(db: D1Like, records: AuthRecordValidator): GrantStore {
	const changed = async (query: string, values: unknown[]) =>
		(await db
			.prepare(query)
			.bind(...values)
			.first()) !== null;
	return {
		async read(actorId) {
			const query = 'SELECT * FROM auth_github_grants WHERE actor_id = ?';
			const row = await db.prepare(query).bind(actorId).first();
			return row ? records.grantState(row) : { generation: 0, grant: null, refreshingUntil: null };
		},
		connect(expected, record) {
			const row = [record.actorId, ...tokens(record), record.createdAt, record.expiresAt, expected];
			return changed(CONNECT, [...row, expected, record.actorId, expected]);
		},
		lease(lease) {
			const { actorId, generation, now, until } = lease;
			return changed(LEASE, [until, actorId, generation, now, now]);
		},
		rotate(lease, record) {
			return changed(ROTATE, [...tokens(record), ...held(lease)]);
		},
		async revoke(actorId, now) {
			await db.prepare(REVOKE).bind(actorId, now, now, now).run();
		},
		revokeLeased(lease, now) {
			return changed(REVOKE_LEASED, [now, ...held(lease)]);
		}
	};
}
