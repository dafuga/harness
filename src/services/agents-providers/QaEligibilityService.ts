// @harness-uid u_kg5hqy5stu
import type { GitHubAppAdapter } from '../../adapters/agents-providers/GitHubAppAdapter';
import type {
	QaEligibility,
	QaGitHubRow,
	QaTask
} from '../../core/agents-providers/qaThread.types';
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';

const maintainers = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const retest = /ready to retest|retest on staging|please retest/i;

function rows(value: UntrustedValue): QaGitHubRow[] {
	return Array.isArray(value)
		? value.filter((v): v is QaGitHubRow => !!v && typeof v === 'object')
		: [];
}

function text(value: UntrustedValue, max = 4000): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Decides whether an issue's fix is live on staging and testable. Read-only. */
export class QaEligibilityService {
	constructor(
		private readonly github: GitHubAppAdapter,
		private readonly label: string,
		private readonly stagingBranch: string
	) {}

	async evaluate(
		issueNumber: number,
		deployedRevision: string = this.stagingBranch
	): Promise<QaEligibility> {
		const repo = this.github.repoPath;
		const issue = (await this.github.read(`${repo}/issues/${issueNumber}`)) as QaGitHubRow;
		if (issue.state !== 'open' || issue.pull_request)
			return { eligible: false, reason: 'issue-closed' };
		const labels = rows(issue.labels).map((l) => text(l.name, 80));
		if (!labels.includes(this.label)) return { eligible: false, reason: 'label-missing' };
		const fix = await this.liveFix(issueNumber, deployedRevision);
		if (fix === 'none') return { eligible: false, reason: 'no-merged-fix' };
		if (fix === 'not-live') return { eligible: false, reason: 'fix-not-on-staging' };
		const found = await this.instructions(issueNumber, issue);
		if (!found) return { eligible: false, reason: 'no-instructions' };
		const task: QaTask = {
			issue: issueNumber,
			title: text(issue.title, 200),
			issueUrl: text(issue.html_url, 300),
			fixPr: Number(fix.number),
			fixPrUrl: text(fix.html_url, 300),
			mergeSha: text(fix.merge_commit_sha, 40),
			...found
		};
		return { eligible: true, task };
	}

	private async liveFix(
		issue: number,
		deployedRevision: string
	): Promise<QaGitHubRow | 'none' | 'not-live'> {
		const q = `${this.github.repoQualifier} is:pr is:merged #${issue} in:title,body`;
		const found = (await this.github.read('/search/issues', { q, per_page: '10' })) as QaGitHubRow;
		const merged = rows(found.items).filter((item) => this.mentions(item, issue));
		if (merged.length === 0) return 'none';
		for (const item of merged) {
			const pull = (await this.github.read(
				`${this.github.repoPath}/pulls/${item.number}`
			)) as QaGitHubRow;
			if (
				pull.merged === true &&
				(await this.onStaging(text(pull.merge_commit_sha, 40), deployedRevision))
			)
				return pull;
		}
		return 'not-live';
	}

	private mentions(item: QaGitHubRow, issue: number): boolean {
		const body = `${text(item.title)} ${text(item.body)}`;
		return new RegExp(
			`(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?|related to)\\s+#${issue}\\b`,
			'i'
		).test(body);
	}

	/** The fix commit is an ancestor of staging when staging is ahead of or equal to it. */
	private async onStaging(sha: string, deployedRevision: string): Promise<boolean> {
		if (!/^[0-9a-f]{7,40}$/.test(sha)) return false;
		const path = `${this.github.repoPath}/compare/${sha}...${encodeURIComponent(deployedRevision)}`;
		const compare = (await this.github.read(path)) as QaGitHubRow;
		return compare.status === 'ahead' || compare.status === 'identical';
	}

	private async instructions(
		issue: number,
		body: QaGitHubRow
	): Promise<Pick<QaTask, 'instructions' | 'instructionsSource'> | undefined> {
		const path = `${this.github.repoPath}/issues/${issue}/comments`;
		const comments = rows(await this.github.read(path, { per_page: '30' }));
		const comment = comments
			.filter((c) => maintainers.has(text(c.author_association, 20)) && retest.test(text(c.body)))
			.at(-1);
		if (comment) return { instructions: text(comment.body), instructionsSource: 'retest-comment' };
		const steps = text(body.body).match(/steps to reproduce[\s\S]{20,}/i)?.[0];
		return steps
			? { instructions: steps.slice(0, 2000), instructionsSource: 'issue-steps' }
			: undefined;
	}
}
