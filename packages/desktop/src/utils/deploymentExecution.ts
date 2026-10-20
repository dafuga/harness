import type { DeploymentOptions, ReviewedDeployment } from '../services/DeploymentService';
import type { DeploymentPlugin, DeploymentProgress } from '../models/Deployment.types';
import { deploymentWorktree } from './deploymentWorktree';
import { deploymentCommand } from './deploymentCommand';
import { deploymentCurrent, deploymentHealth, deploymentProof } from './deploymentProof';
import { saveDeployment } from './deploymentState';
import { gitRead, gitRevision } from './gitRead';
interface Runtime extends DeploymentOptions {
	plugin: DeploymentPlugin;
	update: (phase: DeploymentProgress['phase'], detail: string) => void;
}
/** Confirmation is bound to receipts/configuration; production builds an immutable preprod source. */
export async function deploymentExecution(reviewed: ReviewedDeployment, runtime: Runtime) {
	try {
		if (reviewed.plan.blockers.length) throw new Error(reviewed.plan.blockers.join(' '));
		if (reviewed.plan.environment !== 'prod') return await upload(reviewed, reviewed.root, runtime);
		await current(reviewed.root, reviewed, runtime);
		runtime.update('preparing', 'Preparing the preprod commit');
		return await deploymentWorktree(reviewed.root, reviewed.plan.commit, async (directory) => {
			await (runtime.execute ?? deploymentCommand)({
				args: ['bun', 'install', '--frozen-lockfile'],
				cwd: directory
			});
			return upload(reviewed, directory, runtime);
		});
	} catch (error) {
		runtime.update('failed', 'Promotion failed. Inspect the error before retrying.');
		throw error;
	}
}
async function upload(reviewed: ReviewedDeployment, source: string, runtime: Runtime) {
	const { plan, root } = reviewed;
	const config = await current(root, reviewed, runtime);
	const target = config.targets[plan.environment]!;
	if (source !== root) await current(source, reviewed, runtime);
	const execute = runtime.execute ?? deploymentCommand;
	runtime.update(
		'checking',
		`Checking the ${plan.environment === 'prod' ? 'preprod' : 'source'} commit`
	);
	await execute({ args: ['bun', 'run', 'check'], cwd: source });
	runtime.update('building', 'Building the source commit');
	await execute({
		args: ['bun', 'run', 'build'],
		cwd: source,
		env: { CLOUDFLARE_ENV: target.wranglerEnvironment }
	});
	await current(source, reviewed, runtime);
	await current(root, reviewed, runtime);
	runtime.update('uploading', 'Deploying to Cloudflare');
	const deployed = await runtime.plugin.deploy(target, { root: source, commit: plan.commit });
	runtime.update(
		'verifying',
		`Verifying ${plan.environment === 'prod' ? 'production' : plan.environment} health`
	);
	if (!(await (runtime.health ?? deploymentHealth)(target)))
		throw new Error('Deployment health verification failed; environment state was not advanced.');
	await deploymentCurrent(root, plan, {
		plugin: runtime.plugin,
		fingerprint: reviewed.fingerprint,
		phase: ' during deployment'
	});
	await current(source, reviewed, runtime);
	const receipt = {
		configuration: deploymentProof(config),
		...deployed,
		environment: plan.environment,
		commit: plan.commit,
		branch: plan.branch,
		adapter: runtime.plugin.id,
		updatedAt: new Date().toISOString()
	};
	await saveDeployment(root, receipt);
	runtime.update(
		'complete',
		plan.environment === 'prod' ? 'Production is up to date' : `Deployed to ${plan.environment}`
	);
	return receipt;
}
async function current(root: string, reviewed: ReviewedDeployment, runtime: Runtime) {
	if (root !== reviewed.root) {
		const head = await gitRevision(root);
		if (head !== reviewed.plan.commit || (await gitRead(root, ['status', '--porcelain'])).trim())
			throw new Error('The isolated preprod source changed during the production build.');
	}
	return deploymentCurrent(root, reviewed.plan, {
		plugin: runtime.plugin,
		fingerprint: reviewed.fingerprint
	});
}
