// @harness-uid u_b7mnbsg4vi
import { QaSyncError } from '../../core/agents-providers/QaSyncError';
import type { QaIssueLabels } from '../../core/agents-providers/qaSync.types';
import type { GitHubIssueLabelAdapterConfig } from './GitHubIssueLabelAdapter.types';

const repoPart = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;

/**
 * Reads one issue and adds labels with a token scoped to Issues on one repository. There is
 * deliberately no way to remove or replace labels: other workflows own the rest of them.
 */
export class GitHubIssueLabelAdapter implements QaIssueLabels {
	private readonly base: string;

	constructor(private readonly config: GitHubIssueLabelAdapterConfig) {
		if (!repoPart.test(config.owner) || !repoPart.test(config.repo))
			throw new QaSyncError('Invalid GitHub repository binding.');
		this.base = `https://api.github.com/repos/${config.owner}/${config.repo}/issues`;
	}

	async labels(issue: number): Promise<string[] | undefined> {
		const response = await this.send(issue, '');
		if (response.status === 404 || response.status === 410) return undefined;
		if (!response.ok) throw refused('read', issue, response.status);
		const body = (await response.json()) as {
			pull_request?: object;
			labels?: { name?: string }[];
		};
		if (body.pull_request) return undefined;
		if (!Array.isArray(body.labels)) throw refused('read', issue, response.status);
		return body.labels.flatMap((row) => (row.name ? [row.name] : []));
	}

	async addLabel(issue: number, label: string): Promise<void> {
		const response = await this.send(issue, '/labels', { labels: [label] });
		if (!response.ok) throw refused('label', issue, response.status);
	}

	private async send(issue: number, suffix: string, body?: object): Promise<Response> {
		if (!Number.isSafeInteger(issue) || issue < 1) throw new QaSyncError('Invalid issue number.');
		return (this.config.fetch ?? fetch)(`${this.base}/${issue}${suffix}`, {
			method: body ? 'POST' : 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(15_000),
			headers: {
				authorization: `Bearer ${await this.config.token()}`,
				accept: 'application/vnd.github+json',
				'x-github-api-version': '2022-11-28',
				'user-agent': 'harness-qa-sync',
				...(body ? { 'content-type': 'application/json' } : {})
			},
			body: body && JSON.stringify(body)
		});
	}
}

function refused(action: string, issue: number, status: number): QaSyncError {
	return new QaSyncError(`GitHub ${action} of issue #${issue} refused with status ${status}.`);
}

export type { GitHubIssueLabelAdapterConfig } from './GitHubIssueLabelAdapter.types';
