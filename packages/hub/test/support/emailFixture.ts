import type { SignInResult } from '../../src/models/HubAuth.types';
import { EMAIL_PROOF_COOKIE } from '../../src/utils/authCookies';
import { ORIGIN } from './authFixture';
import { LIN } from './googleFixture';
import type { HubBrowser } from './hubBrowser';
import { hubFixture } from './hubFixture';
import type { HubOptions } from './hubFixture';

export const linActor = {
	id: `google-${LIN.sub}`,
	email: LIN.email,
	name: LIN.name,
	emailVerified: true
};

/** The hub with a mailbox in memory, and the steps of a proof as a person would take them. */
export async function emailFixture(options: HubOptions = {}) {
	const hub = await hubFixture(options);
	return {
		...hub,
		/** A Google sign-in for an address that needs proving. It stops at the pending proof. */
		async pending(claims: Record<string, unknown> = LIN) {
			const browser = hub.browser();
			const response = await hub.signIn(browser, claims);
			return { browser, response, result: (await response.clone().json()) as SignInResult };
		},
		/** Asks for a code and reads it out of the in-memory mailbox. */
		async code(browser: HubBrowser): Promise<string> {
			const before = hub.delivery.sent.length;
			await browser.post('/api/auth/email/start');
			return hub.delivery.sent.length > before ? (hub.delivery.sent.at(-1)?.code ?? '') : '';
		},
		verify: (browser: HubBrowser, code: string) => browser.post('/api/auth/email/verify', { code })
	};
}

export type EmailFixture = Awaited<ReturnType<typeof emailFixture>>;

/** A request that carries only a pending-proof cookie, as a second tab or a replay would. */
export function withProof(browser: HubBrowser, path: string, body: unknown = {}): Request {
	const cookie = `${EMAIL_PROOF_COOKIE}=${browser.cookies.get(EMAIL_PROOF_COOKIE) ?? ''}`;
	const headers = { cookie, origin: ORIGIN, 'content-type': 'application/json' };
	return new Request(`${ORIGIN}${path}`, { method: 'POST', body: JSON.stringify(body), headers });
}

export function another(code: string): string {
	return code === '00000000' ? '11111111' : '00000000';
}
