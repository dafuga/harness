export interface FakeRepository {
	id: number;
	owner: string;
	name: string;
	private: boolean;
	admins: number[];
	readers: number[];
}

export interface FakeInstallation {
	id: number;
	appId: number;
	suspended: boolean;
	repositories: FakeRepository[];
}

export interface FakeCall {
	method: string;
	url: string;
	authorization: string | null;
	contentType: string | null;
	accept: string | null;
	body: string;
}

export interface FakeMint {
	installationId: number;
	repositoryIds: number[];
	permissions: Record<string, string>;
	token: string;
}

export interface FakeState {
	now: () => number;
	app: { appId: string; privateKey: string; clientId: string; clientSecret: string };
	verifyKey: CryptoKey;
	logins: Map<number, string>;
	codes: Map<string, { userId: number; challenge: string; redirect: string }>;
	userTokens: Map<string, { userId: number; expiresAt: number }>;
	refreshTokens: Map<string, number>;
	installations: FakeInstallation[];
	calls: FakeCall[];
	mints: FakeMint[];
	/** Awaited before a call is answered, so a test can hold GitHub mid-request. */
	gate: ((call: FakeCall) => Promise<void>) | null;
	/** Knobs a test flips to make GitHub misbehave. */
	outage: boolean;
	widen: boolean;
	expiring: boolean;
}
