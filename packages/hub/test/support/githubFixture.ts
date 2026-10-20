import type { Actor } from 'collaboration';
import { GithubApiAdapter } from '../../src/adapters/GithubApiAdapter';
import { GithubGrantService } from '../../src/services/GithubGrantService';
import { GithubOwnerService } from '../../src/services/GithubOwnerService';
import { InstallationTokenService } from '../../src/services/installation-token-service/InstallationTokenService';
import type { CachedInstallationToken } from '../../src/services/installation-token-service/InstallationTokenService';
import type { GithubAppConfig } from '../../src/utils/authConfig';
import { ORIGIN, authFixture, browserGrant } from './authFixture';
import { githubFake } from './githubFake';
import type { GithubFake } from './githubFake';
import type { FakeCall } from './githubFakeState';
import { COLLABORATION_REPOSITORY, OWNER_INSTALLATION } from './githubFakeState';

/** The hub's GitHub services wired to the in-memory GitHub, with a hand-moved clock. */
export async function githubFixture(overrides: Partial<GithubAppConfig> = {}) {
	const base = authFixture();
	const github = await githubFake(base.now);
	const collaboration = {
		repositoryId: COLLABORATION_REPOSITORY,
		installationId: OWNER_INSTALLATION
	};
	const app: GithubAppConfig = { ...github.state.app, collaboration, ...overrides };
	const api = new GithubApiAdapter({ fetch: github.fetch });
	const cache = new Map<string, CachedInstallationToken>();
	const tokens = new InstallationTokenService({ app, api, cache, now: base.now });
	const { store, secrets, now } = base;
	const grants = new GithubGrantService({ app, api, store, secrets, origin: ORIGIN, now });
	const owner = new GithubOwnerService({ grants, tokens, api, appId: Number(app.appId) });
	return {
		...base,
		github,
		app,
		api,
		cache,
		tokens,
		grants,
		owner,
		/** Signs the actor in and walks the whole GitHub round trip as `githubUser`. */
		async connect(actor: Actor, githubUser: number) {
			const session = await base.sessions.issue(browserGrant(actor));
			const url = await grants.begin(session.record);
			const state = new URL(url).searchParams.get('state') ?? '';
			await grants.complete(session.record, { code: github.approve(githubUser, url), state });
			return session;
		}
	};
}

export type GithubFixture = Awaited<ReturnType<typeof githubFixture>>;

export async function failure(run: Promise<unknown>): Promise<string> {
	try {
		await run;
		return 'accepted';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

/** Holds the first GitHub call that matches, after it was sent, until `release` is called. */
export function holdGithub(github: GithubFake, matches: (call: FakeCall) => boolean) {
	let entered = () => {};
	let release = () => {};
	const reached = new Promise<void>((resolve) => (entered = resolve));
	const open = new Promise<void>((resolve) => (release = resolve));
	let used = false;
	github.state.gate = async (call) => {
		if (used || !matches(call)) return;
		used = true;
		entered();
		await open;
	};
	return { reached, release: () => release() };
}
