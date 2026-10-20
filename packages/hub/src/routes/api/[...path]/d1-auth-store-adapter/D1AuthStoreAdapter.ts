import type {
	AuthStore,
	ChallengeRecord,
	EmailLedgerStore,
	EmailProofStore,
	ExchangeStore,
	GithubStateRecord,
	GrantStore,
	OneTimeStore,
	SessionStore
} from '../../../../models/HubAuthStore.types';
import { d1CredentialStores } from './d1CredentialStores';
import { EMAIL_PURGES } from '../../../../utils/d1EmailStores';
import { d1EmailStores } from './d1EmailStores';
import { EXPIRE_GRANTS } from '../../../../utils/d1GrantStore';
import { d1GrantStore } from './d1GrantStore';
import { d1OneTimeStores } from './d1OneTimeStores';
import { AuthRecordValidator } from '../../../../validators/AuthRecordValidator';

/** The part of Cloudflare's D1Database this adapter uses; a D1Database satisfies it. */
export interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	first<T = unknown>(): Promise<T | null>;
	run(): Promise<unknown>;
}

export interface D1Like {
	prepare(query: string): D1Statement;
}

const purges = [
	'DELETE FROM auth_challenges WHERE expires_at <= ?',
	'DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL',
	'DELETE FROM auth_github_states WHERE expires_at <= ?',
	EXPIRE_GRANTS,
	'DELETE FROM auth_native_exchanges WHERE expires_at <= ?',
	...EMAIL_PURGES
];

/** Authentication state in D1. Single conditional statements keep every claim and swap atomic. */
export class D1AuthStoreAdapter implements AuthStore {
	readonly challenges: OneTimeStore<ChallengeRecord>;
	readonly githubStates: OneTimeStore<GithubStateRecord>;
	readonly exchanges: ExchangeStore;
	readonly sessions: SessionStore;
	readonly grants: GrantStore;
	readonly emailProofs: EmailProofStore;
	readonly emailLedger: EmailLedgerStore;

	constructor(private readonly db: D1Like) {
		const records = new AuthRecordValidator();
		const oneTime = d1OneTimeStores(db, records);
		const credentials = d1CredentialStores(db, records);
		this.challenges = oneTime.challenges;
		this.githubStates = oneTime.githubStates;
		this.exchanges = oneTime.exchanges;
		this.sessions = credentials.sessions;
		this.grants = d1GrantStore(db, records);
		const email = d1EmailStores(db, records);
		this.emailProofs = email.emailProofs;
		this.emailLedger = email.emailLedger;
	}

	/** An arrow property, so a caller may pass `store.purge` around on its own. */
	readonly purge = async (now: number): Promise<void> => {
		for (const query of purges) await this.db.prepare(query).bind(now).run();
	};
}

export function createD1AuthStore(db: D1Like): AuthStore {
	return new D1AuthStoreAdapter(db);
}
