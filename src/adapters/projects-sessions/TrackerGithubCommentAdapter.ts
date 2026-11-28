// @harness-uid u_pa2kr3prra
import { z } from 'zod';
import type {
	TrackerOutgoingMessage,
	TrackerOutgoingResult
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import type { TrackerGithubCommentAdapterConfig } from './TrackerGithubCommentAdapter.types';

const api = 'https://api.github.com';
const destination = /^([a-zA-Z0-9-]+\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99})#([1-9][0-9]{0,11})$/;
const refused = new Set([400, 401, 403, 404, 410, 422, 429]);
const author = z.object({ id: z.int().positive(), login: z.string() });
const receipt = z.object({
	id: z.int().positive(),
	html_url: z.url(),
	user: z.object({ id: z.int().positive() })
});

/** Comments on a reviewed issue or pull request using a verified, repository-scoped sender. */
export class TrackerGithubCommentAdapter {
	constructor(private readonly config: TrackerGithubCommentAdapterConfig) {}

	matches(message: TrackerOutgoingMessage): boolean {
		return this.target(message) !== undefined;
	}

	async send(message: TrackerOutgoingMessage): Promise<TrackerOutgoingResult> {
		const target = this.target(message);
		if (!target) return { kind: 'failed' };
		const signal = AbortSignal.timeout(12_000);
		const fetcher = this.config.fetcher ?? fetch;
		let submitting = false;
		try {
			const token = await this.config.readAccessToken(signal);
			if (!/^[A-Za-z0-9_]{1,4096}$/.test(token)) return { kind: 'failed' };
			const request = {
				redirect: 'error' as const,
				signal,
				headers: {
					authorization: 'Bearer ' + token,
					accept: 'application/vnd.github+json',
					'content-type': 'application/json',
					'user-agent': 'harness-tracker'
				}
			};
			const user = await fetcher(api + '/user', { ...request, method: 'GET' });
			if (!(await this.verify(user))) return { kind: 'failed' };
			submitting = true;
			const [repo, issue] = target;
			const response = await fetcher(`${api}/repos/${repo}/issues/${issue}/comments`, {
				...request,
				method: 'POST',
				body: JSON.stringify({ body: message.body })
			});
			return await this.result(response, target);
		} catch {
			return { kind: submitting ? 'unconfirmed' : 'failed' };
		}
	}

	private target(message: TrackerOutgoingMessage): [string, string] | undefined {
		if (message.channel !== 'github-comment' || message.account !== this.config.account)
			return undefined;
		const match = destination.exec(message.to[0] ?? '');
		if (!match || message.to.length !== 1) return undefined;
		const [, repo, issue] = match;
		if (!this.config.repositories.some((entry) => entry.toLowerCase() === repo.toLowerCase()))
			return undefined;
		if (message.thread && message.thread.id !== issue) return undefined;
		return [repo, issue];
	}

	private async verify(response: Response): Promise<boolean> {
		if (!response.ok) {
			await response.body?.cancel();
			return false;
		}
		const result = author.parse(await response.json());
		return result.id === this.config.userId && result.login === this.config.account;
	}

	private async result(
		response: Response,
		[repo, issue]: [string, string]
	): Promise<TrackerOutgoingResult> {
		if (response.status !== 201) {
			await response.body?.cancel();
			return { kind: refused.has(response.status) ? 'failed' : 'unconfirmed' };
		}
		const result = receipt.parse(await response.json());
		if (result.user.id !== this.config.userId) return { kind: 'unconfirmed' };
		const reference = String(result.id);
		const link = new URL(result.html_url);
		const target = link.pathname.toLowerCase();
		const sameIssue = [
			`/${repo.toLowerCase()}/issues/${issue}`,
			`/${repo.toLowerCase()}/pull/${issue}`
		].includes(target);
		const verified =
			sameIssue &&
			link.hash === '#issuecomment-' + reference &&
			link.origin === 'https://github.com';
		return {
			kind: 'sent',
			receipt: { reference, ...(verified && { url: link.origin + link.pathname + link.hash }) }
		};
	}
}

export type { TrackerGithubCommentAdapterConfig } from './TrackerGithubCommentAdapter.types';
