// @harness-uid u_kg5hqd5nop
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';
import type {
	GitHubAppAdapterConfig,
	GitHubIssueInput,
	GitHubTokenScope
} from './GitHubAppAdapter.types';
import { githubAppJwt } from './github-app-adapter/githubAppJwt';
import { githubPermissions, validRepoPart } from './github-app-adapter/githubPermissions';

const api = 'https://api.github.com';
const segment = '[A-Za-z0-9._~%:-]+';
const readPaths = [
	/^\/search\/(issues|code)$/,
	/^\/repos\/[^/]+\/[^/]+\/issues(\/\d+(\/(comments|events))?)?$/,
	/^\/repos\/[^/]+\/[^/]+\/pulls(\/\d+(\/files)?)?$/,
	/^\/repos\/[^/]+\/[^/]+\/actions\/runs(\/\d+(\/jobs)?)?$/,
	/^\/repos\/[^/]+\/[^/]+\/commits(\/[0-9a-f]{7,40}(\/check-runs)?)?$/,
	new RegExp(`^/repos/[^/]+/[^/]+/(branches|compare|releases)(/${segment})?$`),
	/^\/repos\/[^/]+\/[^/]+\/contents(\/[A-Za-z0-9._~%@+-]+)*$/
];

/** Read-only repo access plus issue creation, using short-lived scoped App installation tokens. */
export class GitHubAppAdapter {
	private readonly cache = new Map<GitHubTokenScope, { token: string; expiresAtMs: number }>();
	private readonly call: typeof fetch;
	private readonly now: () => number;

	constructor(private readonly config: GitHubAppAdapterConfig) {
		if (!validRepoPart(config.owner) || !validRepoPart(config.repo))
			throw new ProjectAssistantError('Invalid GitHub repository binding.');
		this.call = config.fetch ?? fetch;
		this.now = config.now ?? Date.now;
	}

	get repoPath(): string {
		return `/repos/${this.config.owner}/${this.config.repo}`;
	}

	get repoQualifier(): string {
		return `repo:${this.config.owner}/${this.config.repo}`;
	}

	/** GET a repository-scoped resource. Anything outside the allowlist or repo is refused. */
	async read(path: string, query: Readonly<Record<string, string>> = {}): Promise<UntrustedValue> {
		const inRepo = path.startsWith(this.repoPath + '/') || path.startsWith('/search/');
		if (!inRepo || path.includes('..') || !readPaths.some((pattern) => pattern.test(path)))
			throw new ProjectAssistantError('GitHub read refused: path is outside the allowed read set.');
		if (path.startsWith('/search/') && !(query.q ?? '').includes(this.repoQualifier))
			throw new ProjectAssistantError('GitHub search must be scoped to the configured repository.');
		const url = new URL(api + path);
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		return this.send('GET', url, 'read');
	}

	async createIssue(input: GitHubIssueInput): Promise<{ number: number; url: string }> {
		const url = new URL(`${api}${this.repoPath}/issues`);
		const reply = (await this.send('POST', url, 'issues', {
			title: input.title,
			body: input.body,
			...(input.labels?.length ? { labels: input.labels } : {})
		})) as { number?: unknown; html_url?: unknown };
		if (typeof reply.number !== 'number' || typeof reply.html_url !== 'string')
			throw new ProjectAssistantError('GitHub issue creation returned an unexpected reply.');
		return { number: reply.number, url: reply.html_url };
	}

	async commentOnIssue(issue: number, body: string): Promise<void> {
		if (!Number.isSafeInteger(issue) || issue <= 0 || !body.trim())
			throw new ProjectAssistantError('Invalid QA issue comment.');
		await this.send('POST', new URL(`${api}${this.repoPath}/issues/${issue}/comments`), 'issues', {
			body
		});
	}

	private async send(
		method: 'GET' | 'POST',
		url: URL,
		scope: GitHubTokenScope,
		body?: object
	): Promise<UntrustedValue> {
		const response = await this.call(url, {
			method,
			redirect: 'error',
			signal: AbortSignal.timeout(15_000),
			headers: this.headers(await this.token(scope), body !== undefined),
			body: body && JSON.stringify(body)
		});
		if (!response.ok)
			throw new ProjectAssistantError(`GitHub ${method} refused with status ${response.status}.`);
		return response.json();
	}

	private headers(token: string, json: boolean): Record<string, string> {
		return {
			authorization: `Bearer ${token}`,
			accept: 'application/vnd.github+json',
			'x-github-api-version': '2022-11-28',
			'user-agent': 'harness-project-assistant',
			...(json ? { 'content-type': 'application/json' } : {})
		};
	}

	private async token(scope: GitHubTokenScope): Promise<string> {
		const cached = this.cache.get(scope);
		if (cached && cached.expiresAtMs - 60_000 > this.now()) return cached.token;
		const jwt = await this.config.key.withKey(async (pem) =>
			githubAppJwt(this.config.appId, pem, this.now())
		);
		const response = await this.call(
			`${api}/app/installations/${this.config.installationId}/access_tokens`,
			{
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(15_000),
				headers: { ...this.headers(jwt, true) },
				body: JSON.stringify({
					repositories: [this.config.repo],
					permissions: githubPermissions[scope]
				})
			}
		);
		if (!response.ok)
			throw new ProjectAssistantError(`GitHub App token refused with status ${response.status}.`);
		const data = (await response.json()) as { token?: unknown; expires_at?: unknown };
		if (typeof data.token !== 'string' || typeof data.expires_at !== 'string')
			throw new ProjectAssistantError('GitHub App token reply was malformed.');
		this.cache.set(scope, { token: data.token, expiresAtMs: Date.parse(data.expires_at) });
		return data.token;
	}
}

export type {
	GitHubAppAdapterConfig,
	GitHubIssueInput,
	GitHubKeyAccess,
	GitHubTokenScope
} from './GitHubAppAdapter.types';
