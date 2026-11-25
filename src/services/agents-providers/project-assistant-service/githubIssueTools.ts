// @harness-uid u_kg5hqr5yza
import type {
	AssistantToolDefinition,
	AssistantToolResult
} from '../../../core/agents-providers/projectAssistant.types';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import { assistantToolDefinition } from './assistantToolDefinition';
import type { ToolInput } from './assistantTool.types';
import { arr, issueLine, positiveInt, sourceOf, str } from './githubFormat';

function searchQuery(github: GitHubAppAdapter, input: ToolInput): string {
	const parts = [github.repoQualifier, str(input.query, 200)];
	if (input.kind === 'issue' || input.kind === 'pr') parts.push(`is:${input.kind}`);
	if (input.state === 'open' || input.state === 'closed') parts.push(`state:${input.state}`);
	if (input.label) parts.push(`label:"${str(input.label, 60).replaceAll('"', '')}"`);
	return parts.join(' ');
}

async function search(github: GitHubAppAdapter, input: ToolInput): Promise<AssistantToolResult> {
	const q = searchQuery(github, input);
	const data = (await github.read('/search/issues', { q, per_page: '10' })) as ToolInput;
	const items = arr(data.items);
	return {
		text: `total_count=${data.total_count}\n${items.map(issueLine).join('\n')}`,
		sources: items.slice(0, 5).flatMap((item) => sourceOf(item, `#${item.number}`))
	};
}

async function issue(github: GitHubAppAdapter, input: ToolInput): Promise<AssistantToolResult> {
	const number = positiveInt(input.number);
	const data = (await github.read(`${github.repoPath}/issues/${number}`)) as ToolInput;
	const path = `${github.repoPath}/issues/${number}/comments`;
	const comments = arr(await github.read(path, { per_page: '5' }));
	const talk = comments.map((c) => `- ${str(c.body, 400)}`).join('\n');
	return {
		text: `${issueLine(data)}\n${str(data.body, 1500)}\nRecent comments:\n${talk}`,
		sources: sourceOf(data, `#${number}`)
	};
}

async function pull(github: GitHubAppAdapter, input: ToolInput): Promise<AssistantToolResult> {
	const number = positiveInt(input.number);
	const data = (await github.read(`${github.repoPath}/pulls/${number}`)) as ToolInput;
	const base = (data.base ?? {}) as ToolInput;
	const head = `PR #${number} ${str(data.title)} state=${str(data.state, 10)} merged=${data.merged}`;
	const text = `${head} base=${str(base.ref, 80)} merge_commit=${str(data.merge_commit_sha, 40)}\n${str(data.body, 1200)}`;
	return { text, sources: sourceOf(data, `PR #${number}`) };
}

export function githubIssueTools(github: GitHubAppAdapter): AssistantToolDefinition[] {
	const define = assistantToolDefinition;
	const numbered = { fields: { number: 'integer' }, required: ['number'] };
	return [
		define(
			'github_search_issues',
			'Search issues and pull requests. Returns total_count and the first 10. Use for counts.',
			{ fields: { query: 'string', kind: 'issue|pr', state: 'open|closed', label: 'string' } },
			(input) => search(github, input)
		),
		define('github_get_issue', 'Read one issue with its recent comments.', numbered, (input) =>
			issue(github, input)
		),
		define('github_get_pull', 'Read one pull request summary and merge state.', numbered, (input) =>
			pull(github, input)
		)
	];
}
