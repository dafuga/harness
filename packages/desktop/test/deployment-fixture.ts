import { vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DeploymentActivityService } from '../src/services/DeploymentActivityService';
import { DeploymentService } from '../src/services/DeploymentService';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import type {
	CloudflareTarget,
	DeploymentPlugin,
	DeployExecutor
} from '../src/models/Deployment.types';
const roots: string[] = [];
const registries: DeploymentActivityService[] = [];
afterEach(async () => {
	await Promise.all(registries.splice(0).map((registry) => registry.idle()));
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export async function deploymentFixture() {
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
	const execute = vi.fn<DeployExecutor>(async () => 'passed');
	const activities = new DeploymentActivityService();
	registries.push(activities);
	const service = new DeploymentService(session, {
		plugin,
		execute,
		activities,
		health: async () => true
	});
	return { root, commit, config, plugin, execute, service, session, git, activities };
}
