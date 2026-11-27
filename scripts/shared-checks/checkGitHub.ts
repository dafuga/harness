// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../../src/core/errors';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkParts } from '../run-checks';
import { checkKey, trustedCheckRemote } from './checkCache';
import { checkGit } from './checkGit';
import type { GitHubCheckProof, GitHubJob, GitHubReceipt, GitHubRun } from './checkGitHub.types';
import type { CandidateTree, CheckPlan } from './sharedCheck.types';

const githubRepo = 'dafuga/harness';
const checkWorkflow = 'harness-verify.yml';

/** Exact same-repository CI can satisfy a matching recipe or the complete full-check matrix. */
export function githubCheckProof(
	candidate: CandidateTree,
	plan: CheckPlan
): GitHubCheckProof | undefined {
	if (process.env.GITHUB_ACTIONS === 'true' || !trustedCheckRemote(candidate.repo)) return;
	try {
		if (!trustedWorkflow(candidate)) return;
		const runs = api<{ workflow_runs: GitHubRun[] }>(
			`actions/workflows/${checkWorkflow}/runs?head_sha=${candidate.commit}&status=completed&per_page=20`
		);
		for (const run of runs.workflow_runs.slice(0, 3)) {
			if (run.head_sha !== candidate.commit || run.head_repository?.full_name !== githubRepo)
				continue;
			const jobs = api<{ jobs: GitHubJob[] }>(`actions/runs/${run.id}/jobs?per_page=100`).jobs;
			const keys = verifiedKeys({ run, jobs, candidate, plan });
			if (keys.size)
				return { keys, url: `https://github.com/${githubRepo}/actions/runs/${run.id}` };
		}
	} catch {
		// An unavailable or partial GitHub result is a cache miss.
	}
}

function trustedWorkflow(candidate: CandidateTree): boolean {
	return !checkGit(candidate.repo, [
		'diff',
		'--name-only',
		candidate.base,
		candidate.commit,
		'--',
		`.github/workflows/${checkWorkflow}`,
		'scripts/run-checks.ts',
		'scripts/with-resources.ts',
		'scripts/shared-checks.ts',
		'scripts/shared-checks/',
		'package.json'
	]);
}

function verifiedKeys(input: {
	run: GitHubRun;
	jobs: GitHubJob[];
	candidate: CandidateTree;
	plan: CheckPlan;
}): Set<string> {
	const { run, jobs, candidate, plan } = input;
	if (plan.mode !== 'focused' && requiresEveryPart(jobs)) return new Set(plan.checks.map(checkKey));
	const focused = jobs.some(
		(job) =>
			job.name === 'Relevant checks' &&
			job.conclusion === 'success' &&
			job.steps.some((step) => step.name === 'Run selected checks' && step.conclusion === 'success')
	);
	if (!focused) return new Set();
	const receipt = downloadReceipt(run.id);
	if (
		receipt.status !== 'passed' ||
		receipt.commit !== candidate.commit ||
		receipt.tree !== candidate.tree
	)
		return new Set();
	const admitted = new Set(plan.checks.map(checkKey));
	return new Set(
		receipt.checks.flatMap(({ source, key }) =>
			source === 'executed' && key && admitted.has(key) ? [key] : []
		)
	);
}

function requiresEveryPart(jobs: GitHubJob[]): boolean {
	return Object.keys(checkParts).every((name) =>
		jobs.some(
			(job) =>
				job.name === `Full check part (${name})` &&
				job.conclusion === 'success' &&
				job.steps.some(
					(step) =>
						step.name ===
							'Format, types, lint, Rust native and Wasm, tests, build, package and audits' &&
						step.conclusion === 'success'
				)
		)
	);
}

function downloadReceipt(runId: number): GitHubReceipt {
	const directory = mkdtempSync(join(tmpdir(), 'harness-ci-check-'));
	try {
		gh([
			'run',
			'download',
			String(runId),
			'-R',
			githubRepo,
			'-n',
			'shared-check-result',
			'-D',
			directory
		]);
		return JSON.parse(
			readFileSync(join(directory, 'shared-check-result.json'), 'utf8')
		) as GitHubReceipt;
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function api<T>(path: string): T {
	return JSON.parse(gh(['api', `repos/${githubRepo}/${path}`])) as T;
}

function gh(args: string[]): string {
	const result = spawnSync('gh', args, {
		encoding: 'utf8',
		timeout: 10_000,
		maxBuffer: 4 * 1024 * 1024
	});
	if (result.status !== 0) throw new ExpectedCliError('GitHub checks unavailable.');
	return result.stdout;
}
