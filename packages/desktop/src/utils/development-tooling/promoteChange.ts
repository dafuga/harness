import type { PromotionContext } from './promoteChange.types';
import type { RunRequest } from '../../models/DesktopBridge.types';
import type { ProjectSessionService } from '../../services/ProjectSessionService';
import { DeploymentService } from '../../services/development-tooling/DeploymentService';
import { changeEnvironment } from './changeEnvironment';
import { deploymentConfig } from './deploymentConfig';
import { deploymentCommand } from './deploymentCommand';
import { gitRead } from '../gitRead';
import { sourceSnapshot, type SourceSnapshot } from '../sourceSnapshot';
import { sourceChanges } from '../sourceChanges';
/** A scoped change cannot quietly become a local-only change or deploy an unverified mapping. */
export async function prepareChangeEnvironment(
	session: ProjectSessionService,
	request:
		| Pick<RunRequest, 'mode' | 'environment'>
		| { mode: 'ask' | 'change'; environment?: RunRequest['environment'] }
) {
	if (request.mode !== 'change' || request.environment === undefined) return;
	const root = session.requireProject().root;
	const config = await deploymentConfig(root);
	const branch = (await gitRead(root, ['symbolic-ref', '--short', 'HEAD'])).trim();
	if (branch !== config.sourceBranch)
		throw new Error(
			'Switch to the configured deployment source branch before requesting an environment change.'
		);
	if ((await gitRead(root, ['status', '--porcelain'])).trim())
		throw new Error('Environment changes require a clean source worktree.');
	for (const environment of changeEnvironment(request.environment)) {
		if (!config.targets[environment])
			throw new Error(
				`Configure the ${environment} deployment target before requesting this change.`
			);
	}
}
export async function promoteChange(
	context: PromotionContext,
	before: SourceSnapshot
): Promise<string> {
	const environment = context.request.environment;
	if (!environment) return 'Code changes recorded. Verification is still required.';
	if (context.signal.aborted) throw new Error('Change cancelled before deployment.');
	const { root, emit, id } = context;
	emit({
		runId: id,
		kind: 'status',
		phase: 'recording',
		detail: 'Verifying the environment change before committing'
	});
	await deploymentCommand({ args: ['bun', 'run', 'check'], cwd: root });
	await context.session.atBranch(context.revision.branch);
	if (context.signal.aborted) throw new Error('Change cancelled before deployment.');
	const paths = sourceChanges(before, await sourceSnapshot(root)).map((item) => item.path);
	if (paths.length) await gitRead(root, ['add', '--', ...paths]);
	const staged = await gitRead(root, ['diff', '--cached', '--name-only']);
	if (staged.trim())
		await gitRead(root, ['commit', '-m', 'feat: implement verified environment change']);
	const commit = (await gitRead(root, ['rev-parse', 'HEAD'])).trim();
	const service = new DeploymentService(context.session);
	await service.enqueue({ environment, commit });
	const last = changeEnvironment(environment).at(-1);
	return `Change verified and committed. Deployments through ${last} are queued; follow the deployment activity indicator.${environment === 'prod' ? ' Use Deploy to promote preprod to production.' : ''}`;
}
