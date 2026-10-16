import type { Actor } from 'collaboration';
import { SessionRepository } from '../../src/repositories/SessionRepository';
import { authSecrets } from '../../src/utils/authSecrets';
import type { AuthSecrets } from '../../src/utils/authSecrets';
import { START } from './googleFixture';
import { memoryAuthStore } from './memoryAuthStore';
import type { MemoryAuthStore } from './memoryAuthStore';

export const ORIGIN = 'https://hub.test';
export const SECRET = 'synthetic-session-secret-0123456789abcdef';
export const ada: Actor = {
	id: 'google-110000000000000000001',
	email: 'ada@gmail.com',
	name: 'Ada Example',
	emailVerified: true
};
export const grace: Actor = {
	id: 'google-220000000000000000002',
	email: 'grace@gmail.com',
	name: 'Grace Example',
	emailVerified: true
};

export interface AuthFixture {
	store: MemoryAuthStore;
	secrets: AuthSecrets;
	sessions: SessionRepository;
	now: () => number;
	advance(milliseconds: number): void;
}

/** Shared synthetic state with a clock the test moves by hand. */
export function authFixture(): AuthFixture {
	let clock = START;
	const store = memoryAuthStore();
	const secrets = authSecrets(SECRET);
	const now = () => clock;
	return {
		store,
		secrets,
		now,
		sessions: new SessionRepository({ store: store.sessions, secrets, now }),
		advance(milliseconds) {
			clock += milliseconds;
		}
	};
}

export function browserGrant(actor: Actor = ada) {
	return { kind: 'browser' as const, actor, resource: 'projects', parentHash: null };
}
