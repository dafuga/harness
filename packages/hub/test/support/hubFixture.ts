import type { FakeDelivery, HubOptions } from './hubFixture.types';
import type {
	AuthChallenge,
	EmailProofDelivery,
	EmailProofMessage
} from '../../src/models/HubAuth.types';
import { GoogleIdentityService } from '../../src/services/GoogleIdentityService';
import type { AuthConfig } from '../../src/utils/authConfig';
import { composeHubAuth } from '../../src/lib/server/auth/composeHubAuth';
import { ORIGIN, SECRET } from './authFixture';
import { githubFake } from './githubFake';
import { COLLABORATION_REPOSITORY, OWNER_INSTALLATION } from './githubFakeState';
import { CLIENT_ID, START, googleFixture } from './googleFixture';
import { HubBrowser } from './hubBrowser';
import { memoryAuthStore } from './memoryAuthStore';

/** A mailbox in memory. Nothing is sent anywhere. */
function fakeDelivery(): FakeDelivery {
	const sent: EmailProofMessage[] = [];
	return {
		sent,
		failing: false,
		async send(message) {
			if (this.failing) throw new Error('provider detail: key re_synthetic was refused');
			sent.push(message);
		}
	};
}

/**
 * The whole hub authentication stack behind `handle` and `actor`, exactly as production composes
 * it, with three things injected: real RSA keys for Google, an in-memory GitHub, and a clock.
 */
export async function hubFixture(options: HubOptions = {}) {
	let clock = START;
	const now = () => clock;
	const store = memoryAuthStore();
	const google = await googleFixture(now);
	const github = await githubFake(now);
	const collaboration = {
		repositoryId: COLLABORATION_REPOSITORY,
		installationId: OWNER_INSTALLATION
	};
	const config: AuthConfig = {
		clientId: CLIENT_ID,
		secret: SECRET,
		origin: ORIGIN,
		environment: 'staging',
		github: options.github === false ? null : { ...github.state.app, collaboration }
	};
	const identity = new GoogleIdentityService({ clientId: CLIENT_ID, keys: google.keys, now });
	const delivery = fakeDelivery();
	const mail = options.delivery === false ? null : delivery;
	const parts = { config, store, google: identity, fetch: github.fetch, now, delivery: mail };
	const auth = composeHubAuth({ ...parts, tokenCache: new Map() });
	return {
		auth,
		store,
		google,
		github,
		delivery,
		now,
		advance(milliseconds: number) {
			clock += milliseconds;
		},
		browser: () => new HubBrowser(auth),
		async challenge(browser: HubBrowser): Promise<AuthChallenge> {
			return (await (await browser.post('/api/auth/challenge')).json()) as AuthChallenge;
		},
		/** Challenge, a Google-signed credential for its nonce, then the sign-in POST. */
		async signIn(browser: HubBrowser, claims: Record<string, unknown> = {}): Promise<Response> {
			const { nonce, csrf } = await this.challenge(browser);
			const credential = await google.sign(google.claims(nonce, claims));
			return browser.post('/api/auth/google', { credential, csrf });
		}
	};
}

export async function errorOf(response: Response): Promise<string> {
	const body = (await response.json()) as { error?: string };
	return `${response.status} ${body.error}`;
}

export type { HubOptions, FakeDelivery, HubFixture } from './hubFixture.types';
