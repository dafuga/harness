import type { FakeState } from './githubFakeState';

export interface GithubFake {
	state: FakeState;
	fetch: typeof fetch;
	/** The user approving the app on github.com: returns the code GitHub would send back. */
	approve(userId: number, authorizeUrl: string): string;
	/** The user revoking the app's authorization on github.com. */
	revoke(userId: number): void;
}
