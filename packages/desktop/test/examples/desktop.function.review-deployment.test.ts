import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reviewDeployment } from '../../src/utils/projects-sessions/reviewDeployment';

function createProject(): { root: string; commit: string } {
	const root = mkdtempSync(join(tmpdir(), 'review-deployment-'));
	execFileSync('git', ['init', '-b', 'main', root], { stdio: 'ignore' });
	execFileSync('git', ['-C', root, 'config', 'user.email', 'example@example.test']);
	execFileSync('git', ['-C', root, 'config', 'user.name', 'Example']);
	execFileSync('git', ['-C', root, 'commit', '--allow-empty', '-m', 'example']);
	const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	return { root, commit };
}

function developmentTarget() {
	return {
		environment: 'dev' as const,
		kind: 'workers' as const,
		config: 'wrangler.jsonc',
		name: 'sample-app',
		accountId: 'account-example',
		tokenEnv: 'SAMPLE_DEV_TOKEN',
		wranglerEnvironment: 'dev',
		branch: '',
		output: '',
		healthUrl: 'https://dev.example.test/health'
	};
}

function summarize(result: Awaited<ReturnType<typeof reviewDeployment>>) {
	return {
		environment: result.plan.environment,
		commit: result.plan.commit,
		branch: result.plan.branch,
		adapter: result.plan.adapter,
		target: result.plan.target,
		blockers: result.plan.blockers,
		sourceEnvironment: result.sourceEnvironment,
		projectId: result.projectId,
		steps: result.plan.steps
	};
}

test('reviews a configured development deployment', async () => {
	const { root, commit } = createProject();
	try {
		const target = developmentTarget();
		const config = { sourceBranch: 'main', targets: { dev: target } };
		const result = await reviewDeployment(
			root,
			{ environment: 'dev', commit, projectId: 'input-project' },
			{
				plugin: {
					id: 'cloudflare',
					discover: async () => config,
					deploy: async () => ({ deploymentId: 'unused', url: 'unused' })
				},
				projectId: 'project-example'
			}
		);
		const output = summarize(result);
		expect(output).toMatchObject({
			environment: 'dev',
			commit,
			branch: 'main',
			adapter: 'cloudflare',
			target: 'workers · sample-app · dev · account account-example · https://dev.example.test/health',
			blockers: [],
			sourceEnvironment: null,
			projectId: 'project-example'
		});
		recordExampleCases(
			{
				unitId: 'desktop.function.review-deployment',
				symbol: 'reviewDeployment',
				state: 'reviews-a-configured-development-deployment',
				evidence: 'examples-cases',
				file: 'reviews-a-configured-development-deployment.json'
			},
			[
				{
					name: 'review the current clean development source',
					input: { environment: 'dev', commit, config, projectId: 'project-example' },
					output
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
