import type { HubEnvironment } from '../models/HubAuth.types';
import type {
	ChallengeRecord,
	EmailProofRecord,
	GithubGrantRecord,
	GithubStateRecord,
	GrantState,
	NativeExchangeRecord,
	SessionRecord,
	VerifiedEmailRecord
} from '../models/HubAuthStore.types';

type Row = Record<string, unknown>;

const kinds = ['browser', 'native'] as const;
const statuses = ['pending', 'approved', 'consumed'] as const;
const environments: readonly HubEnvironment[] = ['local', 'staging', 'production'];

function corrupt(): never {
	throw new Error('Hub auth record corrupt');
}

function rowOf(value: unknown): Row {
	return typeof value === 'object' && value !== null ? (value as Row) : corrupt();
}

function text(row: Row, key: string): string {
	const value = row[key];
	return typeof value === 'string' && value.length > 0 ? value : corrupt();
}

function integer(row: Row, key: string): number {
	const value = row[key];
	return typeof value === 'number' && Number.isSafeInteger(value) ? value : corrupt();
}

function optional<T>(row: Row, key: string, read: (row: Row, key: string) => T): T | null {
	return row[key] === null || row[key] === undefined ? null : read(row, key);
}

function oneOf<T extends string>(row: Row, key: string, allowed: readonly T[]): T {
	const value = text(row, key);
	return allowed.includes(value as T) ? (value as T) : corrupt();
}

/** Turns a stored row into a typed record, or throws. A row is never coerced into shape. */
export class AuthRecordValidator {
	challenge(value: unknown): ChallengeRecord {
		const row = rowOf(value);
		return {
			idHash: text(row, 'id_hash'),
			nonce: text(row, 'nonce'),
			csrfHash: text(row, 'csrf_hash'),
			expiresAt: integer(row, 'expires_at')
		};
	}

	session(value: unknown): SessionRecord {
		const row = rowOf(value);
		return {
			idHash: text(row, 'id_hash'),
			kind: oneOf(row, 'kind', kinds),
			parentHash: optional(row, 'parent_hash', text),
			actor: {
				id: text(row, 'actor_id'),
				email: text(row, 'actor_email'),
				name: text(row, 'actor_name'),
				emailVerified: true
			},
			resource: text(row, 'resource'),
			createdAt: integer(row, 'created_at'),
			expiresAt: integer(row, 'expires_at'),
			revokedAt: optional(row, 'revoked_at', integer)
		};
	}

	githubState(value: unknown): GithubStateRecord {
		const row = rowOf(value);
		return {
			idHash: text(row, 'id_hash'),
			sessionHash: text(row, 'session_hash'),
			actorId: text(row, 'actor_id'),
			grantGeneration: integer(row, 'grant_generation'),
			verifierCipher: text(row, 'verifier_cipher'),
			expiresAt: integer(row, 'expires_at')
		};
	}

	grant(value: unknown): GithubGrantRecord {
		const row = rowOf(value);
		return {
			actorId: text(row, 'actor_id'),
			githubUserId: integer(row, 'github_user_id'),
			login: text(row, 'login'),
			tokenCipher: text(row, 'token_cipher'),
			tokenExpiresAt: optional(row, 'token_expires_at', integer),
			refreshCipher: optional(row, 'refresh_cipher', text),
			refreshExpiresAt: optional(row, 'refresh_expires_at', integer),
			createdAt: integer(row, 'created_at'),
			expiresAt: integer(row, 'expires_at')
		};
	}

	emailProof(value: unknown): EmailProofRecord {
		const row = rowOf(value);
		const actor = {
			id: text(row, 'actor_id'),
			email: text(row, 'actor_email'),
			name: text(row, 'actor_name'),
			emailVerified: true as const
		};
		return {
			idHash: text(row, 'id_hash'),
			actor,
			codeHash: optional(row, 'code_hash', text),
			codeExpiresAt: optional(row, 'code_expires_at', integer),
			attempts: integer(row, 'attempts'),
			claimed: oneOf({ claimed: String(integer(row, 'claimed')) }, 'claimed', ['0', '1']) === '1',
			expiresAt: integer(row, 'expires_at')
		};
	}

	verifiedEmail(value: unknown): VerifiedEmailRecord {
		const row = rowOf(value);
		return {
			actorId: text(row, 'actor_id'),
			emailHash: text(row, 'email_hash'),
			verifiedAt: integer(row, 'verified_at'),
			expiresAt: integer(row, 'expires_at')
		};
	}

	/** A revoked row is a tombstone: its generation counts, its other columns are blank. */
	grantState(value: unknown): GrantState {
		const row = rowOf(value);
		const generation = integer(row, 'generation');
		if (optional(row, 'revoked_at', integer) !== null) {
			return { generation, grant: null, refreshingUntil: null };
		}
		const refreshingUntil = optional(row, 'refreshing_until', integer);
		return { generation, grant: this.grant(row), refreshingUntil };
	}

	exchange(value: unknown): NativeExchangeRecord {
		const row = rowOf(value);
		return {
			id: text(row, 'id'),
			challenge: text(row, 'challenge'),
			nonceHash: text(row, 'nonce_hash'),
			codeHash: text(row, 'code_hash'),
			resource: text(row, 'resource'),
			audience: text(row, 'audience'),
			action: text(row, 'action'),
			environment: oneOf(row, 'environment', environments),
			origin: text(row, 'origin'),
			status: oneOf(row, 'status', statuses),
			subject: optional(row, 'subject', text),
			parentHash: optional(row, 'parent_hash', text),
			expiresAt: integer(row, 'expires_at')
		};
	}
}
