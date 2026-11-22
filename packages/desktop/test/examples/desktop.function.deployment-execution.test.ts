import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { deploymentExecution } from '../../src/utils/projects-sessions/deploymentExecution';
import { deploymentProof } from '../../src/utils/projects-sessions/deploymentProof';
import { deploymentState, saveDeployment } from '../../src/utils/projects-sessions/deploymentState';
import type { Runtime } from '../../src/utils/projects-sessions/deploymentExecution.types';
import type { ReviewedDeployment } from '../../src/services/development-tooling/DeploymentService';
import type {
	DeploymentConfig,
	DeploymentPlan,
	DeploymentReceipt
} from '../../src/models/development-tooling/Deployment.types';

const commit = '5e8a0c3f9d2b47e1a6c4f8d0b9e3a7c5d1f2e4b6';
const target = {
	environment: 'dev',
	kind: 'workers',
	config: 'wrangler.toml',
	name: 'harness-dev',
	accountId: 'fixture-account',
	tokenEnv: 'CLOUDFLARE_API_TOKEN',
	wranglerEnvironment: 'dev',
	branch: 'main',
	output: 'dist',
	healthUrl: 'https://harness-dev.example.invalid/api/health'
} as const;
const config = { sourceBranch: 'main', targets: { dev: target } } satisfies DeploymentConfig;

function reviewed(root: string, blockers: string[] = []): ReviewedDeployment {
	const plan: DeploymentPlan = {
		id: '3f6c1a2e-8b4d-4c7e-9a10-5d2b7e9f1c84',
		environment: 'dev',
		commit,
		branch: 'main',
		adapter: 'cloudflare',
		target: 'workers · harness-dev · dev',
		steps: 'Prepare source|Run checks|Build source|Deploy to Cloudflare|Verify health'.split('|'),
		blockers,
		expiresAt: '2030-11-15T09:47:17.318Z'
	};
	return {
		sourceEnvironment: null,
		plan,
		fingerprint: deploymentProof(config),
		root,
		projectId: null,
		predecessor: null
	};
}

function runtimeFor(healthy: boolean) {
	const phases: string[] = [];
	const commands: Array<{ args: string[]; cwd: string; env?: Record<string, string> }> = [];
	const deployments: Array<{ target: string; root: string; commit: string }> = [];
	const runtime: Runtime = {
		plugin: {
			id: 'cloudflare',
			async discover() {
				return config;
			},
			async deploy(selected, source) {
				deployments.push({ target: selected.name, ...source });
				return {
					deploymentId: '7d3f9a1c-54e2-4b8a-9f60-2c1e8b7a5d43',
					url: 'https://harness-dev.example.invalid'
				};
			}
		},
		update(phase) {
			phases.push(phase);
		},
		execute: async ({ args, cwd, env }) => {
			commands.push({ args, cwd, env });
			return '';
		},
		health: async () => healthy
	};
	return { runtime, phases, commands, deployments };
}

async function withFakeRepository<T>(work: (root: string) => Promise<T>): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), 'harness-deployment-execution-'));
	const root = join(directory, 'project');
	const binary = join(directory, 'bin');
	const fakeGit = `#!/bin/sh\ncase "$3:$4" in rev-parse:--git-common-dir) printf '.git\\n' ;; rev-parse:--verify) printf '${commit}\\n' ;; status:*) exit 0 ;; merge-base:*) exit 0 ;; worktree:add) /bin/mkdir -p "$6" ;; worktree:remove) /bin/rm -rf "$6" ;; *) exit 2 ;; esac\n`;
	try {
		await mkdir(join(root, '.git'), { recursive: true });
		await mkdir(binary, { recursive: true });
		await writeFile(join(binary, 'git'), fakeGit);
		await chmod(join(binary, 'git'), 0o755);
		vi.stubEnv('PATH', `${binary}:/bin:/usr/bin`);
		return await work(root);
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
}

const unitId = 'desktop.function.deployment-execution';
function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId,
			symbol: 'deploymentExecution',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function errorResult(error: unknown) {
	return error instanceof Error ? { name: error.name, message: error.message } : null;
}

test('Runs an immutable deployment and records its receipt', async () => {
	await withFakeRepository(async (root) => {
		const input = reviewed(root);
		const run = runtimeFor(true);
		const receipt = await deploymentExecution(input, run.runtime);
		const saved = await deploymentState(root);
		const phases = ['preparing', 'checking', 'building', 'uploading', 'verifying'];
		expect(receipt).toMatchObject({
			environment: 'dev',
			commit,
			branch: 'main',
			adapter: 'cloudflare',
			deploymentId: '7d3f9a1c-54e2-4b8a-9f60-2c1e8b7a5d43',
			url: 'https://harness-dev.example.invalid',
			configuration: input.fingerprint
		});
		expect(run.phases).toEqual(phases);
		expect(run.commands.map(({ args }) => args)).toEqual([
			['bun', 'install', '--frozen-lockfile'],
			['bun', 'run', 'check'],
			['bun', 'run', 'build']
		]);
		expect(run.deployments[0]).toMatchObject({ target: 'harness-dev', commit });
		expect(run.commands.every(({ cwd }) => cwd === run.deployments[0]?.root)).toBe(true);
		expect(run.deployments[0]?.root).not.toBe(root);
		expect(saved).toEqual([receipt]);
		recordCases('runs-an-immutable-deployment-and-records-its-receipt', [
			{
				name: 'Deploy a reviewed dev commit through the isolated checkout',
				input: {
					plan: input.plan,
					fingerprint: input.fingerprint,
					root: '<temporary project>',
					health: true
				},
				output: receipt
			}
		]);
	});
});

test('Rejects plan blockers before preparing source', async () => {
	const input = reviewed('/temporary/project', [
		'Configure the dev target.',
		'Commit source changes first.'
	]);
	const run = runtimeFor(true);
	const error = await deploymentExecution(input, run.runtime).then(() => null, errorResult);
	expect(error).toEqual({
		name: 'DeploymentExecutionError',
		message: 'Configure the dev target. Commit source changes first.'
	});
	expect(run.phases).toEqual([]);
	expect(run.commands).toEqual([]);
	expect(run.deployments).toEqual([]);
	recordCases('rejects-plan-blockers-before-preparing-source', [
		{
			name: 'Reject all recorded blockers together',
			input: { plan: input.plan, root: '<unused project>' },
			error
		}
	]);
});

test('Keeps the previous receipt when health verification fails', async () => {
	await withFakeRepository(async (root) => {
		const input = reviewed(root);
		const run = runtimeFor(false);
		const previous: DeploymentReceipt = {
			environment: 'dev',
			commit: 'c'.repeat(40),
			branch: 'main',
			updatedAt: '2026-11-14T16:05:02.911Z',
			adapter: 'cloudflare',
			deploymentId: 'previous-deployment',
			configuration: input.fingerprint,
			url: 'https://previous.example.invalid'
		};
		await saveDeployment(root, previous);
		const error = await deploymentExecution(input, run.runtime).then(() => null, errorResult);
		const saved = await deploymentState(root);
		expect(error).toEqual({
			name: 'DeploymentExecutionError',
			message: 'Deployment health verification failed; environment state was not advanced.'
		});
		expect(saved).toEqual([previous]);
		expect(run.phases).toEqual(['preparing', 'checking', 'building', 'uploading', 'verifying']);
		expect(run.deployments).toHaveLength(1);
		recordCases('keeps-the-previous-receipt-when-health-verification-fails', [
			{
				name: 'Do not advance the dev receipt after a failed health check',
				input: { plan: input.plan, fingerprint: input.fingerprint, previous, health: false },
				output: { error, retained: saved }
			}
		]);
	});
});
