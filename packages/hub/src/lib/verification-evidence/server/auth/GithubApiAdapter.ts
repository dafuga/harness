import type { GithubApiOptions, InstallationScope, Call } from './GithubApiAdapter.types';
import { authFail } from '../../../../utils/accounts-access/authFail';
import { GithubResponseValidator } from '../../../../validators/development-tooling/GithubResponseValidator';
import type {
	GithubRepository,
	GithubUser,
	GithubUserToken,
	InstallationGrant,
	InstallationList,
	RepositoryPage
} from '../../../../validators/development-tooling/GithubResponseValidator';

const API = 'https://api.github.com';
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token';
const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;
const JSON_TYPE = 'application/json';
const baseHeaders = {
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28',
	'User-Agent': 'harness-hub'
};

/** A redirect that was not followed: a 3xx, or status 0 where the runtime hides it. */
function redirected(response: Response): boolean {
	return response.status === 0 || (response.status >= 300 && response.status < 400);
}

function unavailable(response: Response): boolean {
	const limited =
		response.headers.has('retry-after') || response.headers.get('x-ratelimit-remaining') === '0';
	const refused = response.status === 429 || (response.status === 403 && limited);
	return response.status >= 500 || refused || redirected(response);
}

/**
 * The only code that talks to GitHub for authentication. Hosts are fixed, a redirect is never
 * followed, credentials travel in headers or a form body, and no provider text is passed on.
 */
export class GithubApiAdapter {
	private readonly parse = new GithubResponseValidator();

	constructor(private readonly options: GithubApiOptions) {}

	/** Authorization code or refresh token for a user token. Secrets stay in the form body. */
	async userToken(form: Record<string, string>): Promise<GithubUserToken | null> {
		const body = new URLSearchParams(form).toString();
		// github.com answers this endpoint form-encoded unless JSON is asked for by name.
		const types = { contentType: 'application/x-www-form-urlencoded', accept: JSON_TYPE };
		const data = await this.send(OAUTH_TOKEN, { method: 'POST', ...types, body });
		return this.parse.userToken(data);
	}

	async user(token: string): Promise<GithubUser | null> {
		return this.parse.user(await this.send(`${API}/user`, { authorization: token }));
	}

	/** Installations of this app that the user behind the token can reach. */
	async installations(token: string, appId: number): Promise<InstallationList | null> {
		const url = `${API}/user/installations?per_page=100`;
		return this.parse.installations(await this.send(url, { authorization: token }), appId);
	}

	async installationRepositories(
		token: string,
		installationId: number,
		page: number
	): Promise<RepositoryPage | null> {
		const url = `${API}/user/installations/${installationId}/repositories?per_page=100&page=${page}`;
		return this.parse.repositories(await this.send(url, { authorization: token }));
	}

	/** The repository as the user behind the token sees it, with that user's admin flag. */
	async repository(
		token: string,
		target: { owner: string; name: string }
	): Promise<GithubRepository | null> {
		if (!SEGMENT.test(target.owner) || !SEGMENT.test(target.name)) return null;
		const url = `${API}/repos/${target.owner}/${target.name}`;
		return this.parse.repository(await this.send(url, { authorization: token }));
	}

	/** Authenticated as the app with its short-lived RS256 JWT. */
	async installationToken(
		jwt: string,
		installationId: number,
		scope: InstallationScope
	): Promise<InstallationGrant | null> {
		const url = `${API}/app/installations/${installationId}/access_tokens`;
		const call = { method: 'POST', authorization: jwt, contentType: JSON_TYPE };
		const data = await this.send(url, { ...call, body: JSON.stringify(scope) });
		return this.parse.installationGrant(data);
	}

	/** Null for a client error. Outages, rate limits and unreadable bodies are `github-unavailable`. */
	private async send(url: string, call: Call): Promise<unknown> {
		const response = await this.request(url, call);
		if (unavailable(response)) return authFail('github-unavailable');
		if (!response.ok) return null;
		try {
			return (await response.json()) as unknown;
		} catch {
			return authFail('github-unavailable');
		}
	}

	private async request(url: string, call: Call): Promise<Response> {
		const headers: Record<string, string> = { ...baseHeaders };
		if (call.accept) headers.Accept = call.accept;
		if (call.authorization) headers.Authorization = `Bearer ${call.authorization}`;
		if (call.contentType) headers['Content-Type'] = call.contentType;
		const init = { method: call.method ?? 'GET', headers, body: call.body };
		try {
			// `manual`, not `error`: Cloudflare Workers throw on `error`. A 3xx is then refused above.
			return await this.options.fetch(url, { ...init, redirect: 'manual' });
		} catch {
			return authFail('github-unavailable');
		}
	}
}

export type { GithubApiOptions, InstallationScope } from './GithubApiAdapter.types';
