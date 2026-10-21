import type { Page, Route } from '@playwright/test';
import { ada, clientId, credential, hostedData, type HostedData } from './hosted-data';
import { emailAnswer } from './hosted-email';
import { nativeAnswer } from './hosted-native';
import { projectAnswer } from './hosted-projects';
export * from './hosted-data';

export interface HostedCall {
	method: string;
	path: string;
	query: Record<string, string>;
	body: Record<string, unknown> | null;
}
export interface HostedState {
	configured: boolean;
	signedIn: boolean;
	actor: typeof ada;
	empty: boolean;
	github: { configured: boolean; connected: boolean; login: string | null };
	/** An address that waits for its code, and whether this deployment can send email. */
	email: {
		proof: { email: string; sent: boolean; expiresAt: string | null } | null;
		delivery: boolean;
	};
	/** A desktop app that waits for approval, as the server would describe it. */
	native: { status: string; resource: string | null };
	data: HostedData;
	calls: HostedCall[];
	/** Requests that left the page for Google's own script. */
	google: string[];
}
export type Answer = { status?: number; json?: unknown; bytes?: Uint8Array };

const gis = `window.google = { accounts: { id: {
	initialize(options) { window.__gis = options; },
	renderButton(element) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = 'Sign in with Google';
		button.onclick = () => window.__gis.callback({ credential: window.__credential });
		element.replaceChildren(button);
	}
} } };`;

function githubAnswer(state: HostedState, call: HostedCall): Answer {
	if (!state.signedIn) return { status: 401, json: { error: 'session-required' } };
	if (call.path === '/api/github/status') return { json: state.github };
	const repositories = [{ id: 42, owner: 'acme', name: 'atlas', private: true }];
	return { json: { repositories, truncated: false } };
}

function authAnswer(state: HostedState, call: HostedCall): Answer | null {
	const actor = state.signedIn ? state.actor : null;
	const id = state.configured ? clientId : null;
	if (call.path === '/api/auth/status')
		return { json: { actor, configured: state.configured, clientId: id } };
	const github = call.path.startsWith('/api/github/');
	if (!call.path.startsWith('/api/auth/') && !github) return null;
	if (!state.configured) return { status: 503, json: { error: 'auth-disabled' } };
	if (github) return githubAnswer(state, call);
	if (call.path === '/api/auth/challenge') return { json: { nonce: 'nonce-1', csrf: 'csrf-1' } };
	if (call.path === '/api/auth/logout') {
		state.signedIn = false;
		return { json: { ok: true } };
	}
	const accepted = call.body?.credential === credential && call.body.csrf === 'csrf-1';
	if (!accepted) return { status: 401, json: { error: 'credential-invalid' } };
	state.signedIn = true;
	return { json: { actor: ada } };
}

async function answer(route: Route, state: HostedState) {
	const request = route.request();
	const url = new URL(request.url());
	const call: HostedCall = {
		method: request.method(),
		path: url.pathname,
		query: Object.fromEntries(url.searchParams),
		body: request.postData() ? (request.postDataJSON() as Record<string, unknown>) : null
	};
	state.calls.push(call);
	const auth = emailAnswer(state, call) ?? nativeAnswer(state, call) ?? authAnswer(state, call);
	const found = auth ?? projectAnswer(state, call);
	if (found.bytes)
		return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(found.bytes) });
	return route.fulfill({
		status: found.status ?? 200,
		contentType: 'application/json',
		body: JSON.stringify(found.json)
	});
}

/**
 * Answers the hosted API and Google's script inside the test. The built app holds none of this:
 * without these routes it reaches the real same-origin API and the real Google script.
 */
export async function hostedFixture(page: Page, options: Partial<HostedState> = {}) {
	const state: HostedState = {
		configured: true,
		signedIn: true,
		actor: ada,
		empty: false,
		github: { configured: true, connected: true, login: 'ada-example' },
		email: { proof: null, delivery: true },
		native: { status: 'pending', resource: 'projects' },
		data: hostedData(),
		calls: [],
		google: [],
		...options
	};
	await page.addInitScript((value) => Object.assign(window, { __credential: value }), credential);
	await page.route('https://accounts.google.com/**', (route) => {
		state.google.push(route.request().url());
		return route.fulfill({ status: 200, contentType: 'text/javascript', body: gis });
	});
	await page.route('**/api/**', (route) => answer(route, state));
	return state;
}
