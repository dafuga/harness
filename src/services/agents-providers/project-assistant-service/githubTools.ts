// @harness-uid u_kg5hqi4cde
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';
import type {
	AssistantToolDefinition,
	AssistantToolResult
} from '../../../core/agents-providers/projectAssistant.types';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import { assistantToolDefinition } from './assistantToolDefinition';
import type { ToolInput } from './assistantTool.types';
import { arr, sourceOf, str } from './githubFormat';
import { githubIssueTools } from './githubIssueTools';

const blockedPath =
	/(^|\/)(\.env[^/]*|[^/]*\.(pem|key|p12|pfx)|id_rsa[^/]*|\.secrets?(\/|$)|secrets?\/)/i;

export function githubReadTools(github: GitHubAppAdapter): AssistantToolDefinition[] {
	const repo = github.repoPath;
	const file = async (input: ToolInput): Promise<AssistantToolResult> => {
		const path = str(input.path, 300).replace(/^\/+/, '');
		if (!path || blockedPath.test(path))
			throw new ProjectAssistantError('That path is not readable.');
		const ref = str(input.ref, 100);
		const encoded = path.split('/').map(encodeURIComponent).join('/');
		const data = (await github.read(
			`${repo}/contents/${encoded}`,
			ref ? { ref } : {}
		)) as ToolInput;
		if (Array.isArray(data)) {
			const listing = arr(data).map((e) => `${str(e.type, 8)} ${str(e.path)}`);
			return { text: listing.join('\n'), sources: [] };
		}
		const raw = Buffer.from(str(data.content, 400_000), 'base64').toString('utf8');
		return { text: raw.slice(0, 12_000), sources: sourceOf(data, path) };
	};
	const runs = async (input: ToolInput): Promise<AssistantToolResult> => {
		const query: Record<string, string> = { per_page: '8' };
		if (input.branch) query.branch = str(input.branch, 100);
		const list = arr(
			((await github.read(`${repo}/actions/runs`, query)) as ToolInput).workflow_runs
		);
		const text = list
			.map((r) => {
				const state = `${str(r.status, 20)}/${str(r.conclusion, 20)}`;
				return `run ${String(r.id ?? '')} ${str(r.name, 60)} ${str(r.head_branch, 60)} ${state} ${str(r.head_sha, 10)} ${str(r.created_at, 25)}`;
			})
			.join('\n');
		return { text, sources: list.slice(0, 3).flatMap((r) => sourceOf(r, str(r.name, 40))) };
	};
	return [
		...githubIssueTools(github),
		assistantToolDefinition(
			'github_read_file',
			'Read a file or list a directory in the repository at an optional ref.',
			{ fields: { path: 'string', ref: 'string' }, required: ['path'] },
			file
		),
		assistantToolDefinition(
			'github_list_runs',
			'List recent GitHub Actions runs, optionally for one branch.',
			{ fields: { branch: 'string' } },
			runs
		),
		assistantToolDefinition(
			'github_run_jobs',
			'Read job states for a GitHub Actions run and link to the jobs with their logs.',
			{ fields: { id: 'string' }, required: ['id'] },
			(input) => readRunJobs(github, input)
		)
	];
}

async function readRunJobs(
	github: GitHubAppAdapter,
	input: ToolInput
): Promise<AssistantToolResult> {
	const id = String(input.id ?? '');
	if (!/^[1-9]\d{0,17}$/.test(id))
		throw new ProjectAssistantError('A numeric GitHub Actions run id is required.');
	const result = (await github.read(`${github.repoPath}/actions/runs/${id}/jobs`, {
		per_page: '20'
	})) as ToolInput;
	const list = arr(result.jobs);
	return {
		text: list
			.map((job) => `${str(job.name, 80)} ${str(job.status, 20)}/${str(job.conclusion, 20)}`)
			.join('\n'),
		sources: list.slice(0, 4).flatMap((job) => sourceOf(job, str(job.name, 50)))
	};
}
