import { expect, test, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DeploymentService } from '../../src/services/DeploymentService';
import { ProjectSessionService } from '../../src/services/ProjectSessionService';
import type { CloudflareTarget, DeploymentPlugin } from '../../src/models/Deployment.types';
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-deploy-'));
	roots.push(root);
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	git('init', '-b', 'dev');
	git('config', 'user.name', 'Fixture');
	git('config', 'user.email', 'fixture@example.invalid');
	git('commit', '--allow-empty', '-m', 'feat: fixture');
	const commit = git('rev-parse', 'HEAD');
	const target = (environment: CloudflareTarget['environment']) => ({
		environment,
		kind: 'workers' as const,
		config: 'wrangler.jsonc',
		name: 'fixture-' + environment,
		accountId: 'a'.repeat(32),
		tokenEnv: 'FIXTURE_TOKEN',
		wranglerEnvironment: environment,
		branch: '',
		output: '',
		healthUrl: 'https://example.invalid'
	});
	const config = {
		sourceBranch: 'dev',
		targets: {
			dev: target('dev'),
			stage: target('stage'),
			preprod: target('preprod'),
			prod: target('prod')
		}
	};
	const plugin: DeploymentPlugin = {
		id: 'cloudflare',
		discover: vi.fn(async () => config),
		deploy: vi.fn(async () => ({ deploymentId: 'receipt-1', url: 'https://example.invalid' }))
	};
	const session = new ProjectSessionService();
	session.root = root;
	session.projectId = 'local-' + 'a'.repeat(64);
	const execute = vi.fn(async () => 'passed');
	const service = new DeploymentService(session, { plugin, execute, health: async () => true });
	return { root, commit, config, plugin, execute, service, session, git };
}
test('promotion requires the same commit in every preceding environment and a reviewed single-use plan', async () => {
	const f = await fixture();
	const blocked = await f.service.plan({ environment: 'prod', commit: f.commit });
	expect(blocked.blockers.join(' ')).toMatch(/preprod/);
	await expect(f.service.deploy({ planId: blocked.id })).rejects.toThrow(/preprod/);
	for (const environment of ['dev', 'stage', 'preprod', 'prod'] as const) {
		const plan = await f.service.plan({ environment, commit: f.commit });
		expect(plan.blockers).toEqual([]);
		const receipt = await f.service.deploy({ planId: plan.id });
		expect(receipt).toMatchObject({ environment, commit: f.commit, deploymentId: 'receipt-1' });
		await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/review/);
	}
	expect(f.execute).toHaveBeenCalledTimes(8);
	expect((await f.service.status()).every((item) => item.receipt?.commit === f.commit)).toBe(true);
});
test('changed configuration, source or project invalidates confirmation without deploying', async () => {
	const f = await fixture();
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	f.config.targets.dev.name = 'changed-target';
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/changed/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
	const next = await f.service.plan({ environment: 'dev', commit: f.commit });
	f.git('commit', '--allow-empty', '-m', 'feat: moved');
	await expect(f.service.deploy({ planId: next.id })).rejects.toThrow(/changed|source/);
	const last = await f.service.plan({ environment: 'dev', commit: f.git('rev-parse', 'HEAD') });
	f.session.projectId = 'another';
	await expect(f.service.deploy({ planId: last.id })).rejects.toThrow(/project/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
});
test('failed checks or health verification never advance environment state', async () => {
	const f = await fixture();
	f.execute.mockRejectedValueOnce(new Error('check failed'));
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/check failed/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
	expect((await f.service.status())[0].receipt).toBeNull();
	const service = new DeploymentService(f.session, {
		plugin: f.plugin,
		execute: f.execute,
		health: async () => false
	});
	const next = await service.plan({ environment: 'dev', commit: f.commit });
	await expect(service.deploy({ planId: next.id })).rejects.toThrow(/health/);
	expect((await service.status())[0].receipt).toBeNull();
});

test('automatic promotion refuses protected environments and confirmations expire', async () => {
	const f = await fixture();
	await expect(f.service.automatic({ environment: 'preprod', commit: f.commit })).rejects.toThrow(
		/Deploy UI/
	);
	await expect(f.service.automatic({ environment: 'prod', commit: f.commit })).rejects.toThrow(
		/Deploy UI/
	);
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
	try {
		await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/review/);
	} finally {
		clock.mockRestore();
	}
	expect(f.plugin.deploy).not.toHaveBeenCalled();
});
test('source changes during upload cannot become a verified environment receipt', async () => {
	const f = await fixture();
	vi.mocked(f.plugin.deploy).mockImplementationOnce(async () => {
		f.git('commit', '--allow-empty', '-m', 'feat: source advanced during upload');
		return { deploymentId: 'uploaded', url: 'https://example.invalid' };
	});
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/changed during deployment/);
	expect((await f.service.status())[0].receipt).toBeNull();
});
