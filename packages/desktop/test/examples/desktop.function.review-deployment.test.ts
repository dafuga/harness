import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
	const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
		encoding: 'utf8'
	}).trim();
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

function plugin(
	discover: () => Promise<never> | Promise<{ sourceBranch: string; targets: object }>
) {
	return {
		id: 'cloudflare',
		discover,
		deploy: async () => ({ deploymentId: 'unused', url: 'unused' })
	};
}

function recordError(args: {
	state: string;
	name: string;
	expectedError: string;
	input: unknown;
	error: unknown;
}) {
	const { state, name, expectedError, input, error } = args;
	const output =
		error instanceof Error ? { name: error.name, message: error.message } : String(error);
	expect(error).toBeInstanceOf(Error);
	expect(output).toMatchObject({ name: expectedError });
	recordExampleCases(
		{
			unitId: 'desktop.function.review-deployment',
			symbol: 'reviewDeployment',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name, input, error: output }]
	);
}

async function captureFailure(
	root: string,
	discover: () => Promise<never> | Promise<{ sourceBranch: string; targets: object }>
) {
	try {
		await reviewDeployment(
			root,
			{ environment: 'dev', commit: 'a'.repeat(40) },
			{ plugin: plugin(discover), projectId: null }
		);
		throw new Error('Expected reviewDeployment to reject');
	} catch (error) {
		return error;
	}
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
			target:
				'workers · sample-app · dev · account account-example · https://dev.example.test/health',
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

test('Throws the plugin discovery error unchanged', async () => {
	const root = mkdtempSync(join(tmpdir(), 'review-discover-error-'));
	const failure = new Error('configuration unavailable');
	try {
		const error = await captureFailure(root, async () => {
			throw failure;
		});
		expect(error).toBe(failure);
		recordError({
			state: 'throws-the-plugin-discovery-error-unchanged',
			name: 'plugin discovery rejects',
			expectedError: 'Error',
			input: { root },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws an error when the project is not a Git repository', async () => {
	const root = mkdtempSync(join(tmpdir(), 'review-no-git-'));
	try {
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-an-error-when-the-project-is-not-a-git-repository',
			name: 'Git read fails outside a repository',
			expectedError: 'Error',
			input: { root },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws a SyntaxError when deployment receipts contain invalid JSON', async () => {
	const { root } = createProject();
	try {
		mkdirSync(join(root, '.git', 'harness-deployments'));
		writeFileSync(join(root, '.git', 'harness-deployments', 'receipts.json'), '{');
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-a-syntaxerror-when-deployment-receipts-contain-invali',
			name: 'receipt JSON is malformed',
			expectedError: 'SyntaxError',
			input: { root, contents: '{' },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws a ZodError when deployment receipts do not match the schema', async () => {
	const { root } = createProject();
	try {
		mkdirSync(join(root, '.git', 'harness-deployments'));
		writeFileSync(
			join(root, '.git', 'harness-deployments', 'receipts.json'),
			JSON.stringify([{ environment: 'dev', commit: 'bad' }])
		);
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-a-zoderror-when-deployment-receipts-do-not-match-the',
			name: 'receipt commit fails validation',
			expectedError: 'ZodError',
			input: { root, receipt: { environment: 'dev', commit: 'bad' } },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
