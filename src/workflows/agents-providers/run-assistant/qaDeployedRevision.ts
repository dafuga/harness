// @harness-uid u_wdsnuzioed
import { shortCommit } from '$reports/helpers/strings/shortCommit';
import { z } from 'zod';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { AssistantQaConfig } from './readAssistantConfig.types';

const head = z.object({ commit: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }) });
const checks = z.object({
	check_runs: z.array(
		z.object({
			head_sha: z.string(),
			conclusion: z.string().nullable(),
			app: z.object({ slug: z.string() }).nullable(),
			output: z.object({ summary: z.string().nullable() })
		})
	)
});
const healthy = z.object({ ok: z.literal(true), target: z.string() });

export async function qaDeployedRevision(
	github: GitHubAppAdapter,
	branch: string,
	config: AssistantQaConfig,
	healthUrl: string
): Promise<string | undefined> {
	const ref = github.repoPath + '/branches/' + encodeURIComponent(branch);
	const branchSha = async () => head.parse(await github.read(ref)).commit.sha;
	const sha = await branchSha();
	const [rawChecks, health] = await Promise.all([
		github.read(github.repoPath + '/commits/' + sha + '/check-runs', {
			check_name: config.checkName
		}),
		fetch(healthUrl, { redirect: 'error', signal: AbortSignal.timeout(8000) })
	]);
	const originLink = `<a href='${config.stagingUrl}'>${config.stagingUrl}</a>`;
	const confirmed = checks
		.parse(rawChecks)
		.check_runs.some(
			(check) =>
				check.head_sha === sha &&
				check.conclusion === 'success' &&
				check.app?.slug === config.checkApp &&
				check.output.summary?.includes(originLink) &&
				check.output.summary.includes(`<code>${shortCommit(sha)}</code>`)
		);
	if (!confirmed || !health.ok) return undefined;
	const status = healthy.safeParse(await health.json());
	if (status.success && status.data.target === config.healthTarget && (await branchSha()) === sha)
		return sha;
	return undefined;
}
