import type { GithubFake } from './githubFake.types';
import { randomToken } from '../../src/utils/authSecrets';
import {
	accessTokens,
	installationRepositories,
	oauthToken,
	repository,
	user,
	userInstallations
} from './githubFakeRoutes';
import type { FakeHandler } from './githubFakeRoutes';
import { fakeState } from './githubFakeState';
import type { FakeCall, FakeState } from './githubFakeState';

const routes: [RegExp, FakeHandler][] = [
	[/^POST https:\/\/github\.com\/login\/oauth\/access_token$/, oauthToken],
	[/^GET https:\/\/api\.github\.com\/user$/, user],
	[/^GET https:\/\/api\.github\.com\/user\/installations$/, userInstallations],
	[
		/^GET https:\/\/api\.github\.com\/user\/installations\/(\d+)\/repositories$/,
		installationRepositories
	],
	[/^GET https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)$/, repository],
	[/^POST https:\/\/api\.github\.com\/app\/installations\/(\d+)\/access_tokens$/, accessTokens]
];

async function record(input: RequestInfo | URL, init: RequestInit = {}): Promise<FakeCall> {
	const request = new Request(input, init);
	return {
		method: request.method,
		url: request.url,
		authorization: request.headers.get('authorization'),
		contentType: request.headers.get('content-type'),
		accept: request.headers.get('accept'),
		body: await request.text()
	};
}

async function dispatch(state: FakeState, call: FakeCall): Promise<Response> {
	if (state.outage) return Response.json({ message: 'secret-provider-detail' }, { status: 503 });
	const url = new URL(call.url);
	const target = `${call.method} ${url.origin}${url.pathname}`;
	for (const [pattern, handler] of routes) {
		const match = pattern.exec(target);
		if (match) return handler(state, call, match);
	}
	return Response.json({ message: 'Not Found' }, { status: 404 });
}

/** github.com and api.github.com in memory, with real signature checks on the app JWT. */
export async function githubFake(now: () => number): Promise<GithubFake> {
	const state = await fakeState(now);
	return {
		state,
		async fetch(input, init) {
			// Cloudflare Workers reject `redirect: 'error'` with a TypeError; only `manual` both
			// works there and keeps a redirect from being followed.
			if (init?.redirect !== 'manual') {
				throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"');
			}
			const call = await record(input, init);
			state.calls.push(call);
			await state.gate?.(call);
			return dispatch(state, call);
		},
		approve(userId, authorizeUrl) {
			const query = new URL(authorizeUrl).searchParams;
			const code = randomToken(15);
			const challenge = query.get('code_challenge') ?? '';
			state.codes.set(code, { userId, challenge, redirect: query.get('redirect_uri') ?? '' });
			return code;
		},
		revoke(userId) {
			for (const [token, entry] of state.userTokens) {
				if (entry.userId === userId) state.userTokens.delete(token);
			}
			for (const [token, id] of state.refreshTokens) {
				if (id === userId) state.refreshTokens.delete(token);
			}
		}
	};
}

export type { GithubFake } from './githubFake.types';
