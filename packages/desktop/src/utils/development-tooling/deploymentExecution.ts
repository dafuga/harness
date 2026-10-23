import type { Runtime, Captured } from './deploymentExecution.types';
import type { ReviewedDeployment } from '../../services/development-tooling/DeploymentService';
import { deploymentWorktree } from './deploymentWorktree';
import { deploymentCommand } from './deploymentCommand';
import { deploymentHealth } from './deploymentProof';
import { saveDeployment } from './deploymentState';
import { captureDeploymentTarget, verifyDeploymentSnapshot } from './verifyDeploymentSnapshot';
/** Each target uses its own immutable checkout; later edits and lower deployments can continue. */
export async function deploymentExecution(reviewed: ReviewedDeployment, runtime: Runtime) {
	if (reviewed.plan.blockers.length) throw new Error(reviewed.plan.blockers.join(' '));
	runtime.update('preparing', 'Preparing source');
	const captured = await captureDeploymentTarget(reviewed, runtime.plugin);
	return deploymentWorktree(reviewed.root, reviewed.plan.commit, async (directory) => {
		await (runtime.execute ?? deploymentCommand)({
			args: ['bun', 'install', '--frozen-lockfile'],
			cwd: directory
		});
		return upload(reviewed, directory, runtime, captured);
	});
}
async function upload(
	reviewed: ReviewedDeployment,
	source: string,
	runtime: Runtime,
	captured: Captured
) {
	const { plan, root } = reviewed,
		{ target, destination } = captured;
	const guard = { plugin: runtime.plugin, destination };
	const execute = runtime.execute ?? deploymentCommand;
	await verifyDeploymentSnapshot(source, reviewed, guard);
	runtime.update('checking', 'Checking source commit');
	await execute({ args: ['bun', 'run', 'check'], cwd: source });
	runtime.update('building', 'Building source commit');
	await execute({
		args: ['bun', 'run', 'build'],
		cwd: source,
		env: { CLOUDFLARE_ENV: target.wranglerEnvironment }
	});
	await verifyDeploymentSnapshot(source, reviewed, guard);
	await verifyDeploymentSnapshot(root, reviewed, guard);
	runtime.update('uploading', 'Deploying to Cloudflare');
	const deployed = await runtime.plugin.deploy(target, { root: source, commit: plan.commit });
	runtime.update('verifying', `Verifying ${plan.environment} health`);
	if (!(await (runtime.health ?? deploymentHealth)(target)))
		throw new Error('Deployment health verification failed; environment state was not advanced.');
	await verifyDeploymentSnapshot(root, reviewed, guard);
	await verifyDeploymentSnapshot(source, reviewed, guard);
	const receipt = {
		configuration: reviewed.fingerprint,
		...deployed,
		environment: plan.environment,
		commit: plan.commit,
		branch: plan.branch,
		adapter: runtime.plugin.id,
		updatedAt: new Date().toISOString()
	};
	await saveDeployment(root, receipt);
	return receipt;
}
