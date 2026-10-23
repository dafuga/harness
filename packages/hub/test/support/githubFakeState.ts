import type { FakeRepository, FakeInstallation, FakeState } from './githubFakeState.types';
import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { importSPKI } from 'jose';

export const ADA_GITHUB = 501;
export const GRACE_GITHUB = 502;
export const SOURCE_REPOSITORY = 9001;
export const COLLABORATION_REPOSITORY = 9002;
export const READ_ONLY_REPOSITORY = 9003;
export const FOREIGN_REPOSITORY = 9100;
export const OWNER_INSTALLATION = 71;
export const FOREIGN_INSTALLATION = 72;

function repository(id: number, name: string, access: Partial<FakeRepository>): FakeRepository {
	return { id, owner: 'synthetic-org', name, private: true, admins: [], readers: [], ...access };
}

/** Ada administers two repositories and reads a third. Grace owns a separate installation. */
function installations(appId: number): FakeInstallation[] {
	const owned = [
		repository(SOURCE_REPOSITORY, 'source', { admins: [ADA_GITHUB], private: false }),
		repository(COLLABORATION_REPOSITORY, 'collaboration', { admins: [ADA_GITHUB] }),
		repository(READ_ONLY_REPOSITORY, 'read-only', { readers: [ADA_GITHUB] })
	];
	const foreign = [
		repository(FOREIGN_REPOSITORY, 'foreign', { owner: 'other-org', admins: [GRACE_GITHUB] })
	];
	return [
		{ id: OWNER_INSTALLATION, appId, suspended: false, repositories: owned },
		{ id: FOREIGN_INSTALLATION, appId, suspended: false, repositories: foreign }
	];
}

let shared: { publicKey: KeyObject; privateKey: KeyObject } | undefined;

/** A real RSA key pair: the hub signs with the PKCS#1 PEM, the fake verifies with the public key. */
export async function fakeState(now: () => number): Promise<FakeState> {
	const pair = (shared ??= generateKeyPairSync('rsa', { modulusLength: 2048 }));
	const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
	return {
		now,
		app: {
			appId: '4242',
			privateKey: pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
			clientId: 'Iv1.synthetic',
			clientSecret: 'synthetic-client-secret'
		},
		verifyKey: await importSPKI(publicPem, 'RS256'),
		logins: new Map([
			[ADA_GITHUB, 'ada-hub'],
			[GRACE_GITHUB, 'grace-hub']
		]),
		codes: new Map(),
		userTokens: new Map(),
		refreshTokens: new Map(),
		installations: installations(4242),
		calls: [],
		mints: [],
		gate: null,
		outage: false,
		widen: false,
		expiring: true
	};
}

export type {
	FakeRepository,
	FakeInstallation,
	FakeCall,
	FakeMint,
	FakeState
} from './githubFakeState.types';
