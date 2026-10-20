import { randomUUID } from 'node:crypto';
import { CloudflareDeployAdapter } from '../adapters/CloudflareDeployAdapter';
import type {
	DeployExecutor,
	DeployInput,
	DeploymentPlan,
	DeploymentPlugin,
	DeploymentQuery,
	CloudflareTarget
} from '../models/Deployment.types';
import type { ProjectContext } from '../models/ProjectContext.types';
import type { ProjectSessionService } from './ProjectSessionService';
import { deploymentCommand } from '../utils/deploymentCommand';
import {
	deploymentBlockers,
	deploymentProof,
	deploymentHealth,
	deploymentCurrent
} from '../utils/deploymentProof';
import { deploymentStatus, saveDeployment } from '../utils/deploymentState';
interface Options {
	plugin?: DeploymentPlugin;
	execute?: DeployExecutor;
	health?: (target: CloudflareTarget) => Promise<boolean>;
}
interface Reviewed {
	plan: DeploymentPlan;
	fingerprint: string;
	root: string;
	projectId: string | null;
}
/** Plans live in this desktop session; no renderer input supplies commands, targets or credentials. */
export class DeploymentService {
	private plans = new Map<string, Reviewed>();
	private plugin: DeploymentPlugin;
	constructor(
		private session: ProjectSessionService,
		private options: Options = {}
	) {
		this.plugin = options.plugin ?? new CloudflareDeployAdapter();
	}
	async status(input: ProjectContext = {}) {
		return deploymentStatus(this.root(input), this.plugin);
	}

	async plan(input: DeploymentQuery): Promise<DeploymentPlan> {
		const root = this.root(input);
		const config = await this.plugin.discover(root);
		const { blockers, branch } = await deploymentBlockers(root, input, config);
		const target = config.targets[input.environment];
		const plan = {
			id: randomUUID(),
			environment: input.environment,
			commit: input.commit,
			branch,
			adapter: this.plugin.id,
			target: target
				? `${target.kind} · ${target.name} · ${target.wranglerEnvironment || target.branch} · account ${target.accountId} · ${target.healthUrl}`
				: 'Unconfigured',
			steps: [
				'Run bun run check',
				'Build the source commit',
				'Deploy with Cloudflare',
				'Verify deployment identity and health'
			],
			blockers,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
		};
		for (const [id, value] of this.plans)
			if (Date.parse(value.plan.expiresAt) <= Date.now()) this.plans.delete(id);
		if (this.plans.size >= 32) this.plans.delete(this.plans.keys().next().value!);
		this.plans.set(plan.id, {
			plan,
			root,
			projectId: this.session.projectId,
			fingerprint: deploymentProof(config)
		});
		return plan;
	}
	async deploy(input: DeployInput) {
		const reviewed = this.plans.get(input.planId);
		this.plans.delete(input.planId);
		if (!reviewed || Date.parse(reviewed.plan.expiresAt) <= Date.now())
			throw new Error('Please review a fresh deployment plan.');
		const root = this.root(input);
		if (root !== reviewed.root || this.session.projectId !== reviewed.projectId)
			throw new Error('The selected project changed.');
		if (this.session.busy || !this.session.arbiter.hold(root, this))
			throw new Error('Wait for the active project operation.');
		this.session.busy = true;
		try {
			return await this.session.arbiter.exclusive(root, () => this.execute(reviewed));
		} finally {
			this.session.busy = false;
			this.session.arbiter.release(root, this);
		}
	}
	/** Internal change-run path, bounded even if a caller passes a forged environment. */
	async automatic(input: DeploymentQuery) {
		if (!['dev', 'stage'].includes(input.environment))
			throw new Error('Protected environments require the Deploy UI.');
		const plan = await this.plan(input);
		const reviewed = this.plans.get(plan.id)!;
		this.plans.delete(plan.id);
		return this.execute(reviewed);
	}
	private async execute(reviewed: Reviewed) {
		const { plan, root } = reviewed;
		const guard = { plugin: this.plugin, fingerprint: reviewed.fingerprint };
		const config = await deploymentCurrent(root, plan, guard);
		const execute = this.options.execute ?? deploymentCommand;
		const buildEnv = { CLOUDFLARE_ENV: config.targets[plan.environment]!.wranglerEnvironment };
		await execute({ args: ['bun', 'run', 'check'], cwd: root });
		await execute({ args: ['bun', 'run', 'build'], cwd: root, env: buildEnv });
		const finalConfig = await deploymentCurrent(root, plan, guard);
		const target = finalConfig.targets[plan.environment]!;
		const deployed = await this.plugin.deploy(target, { root, commit: plan.commit });
		if (!(await (this.options.health ?? deploymentHealth)(target)))
			throw new Error('Deployment health verification failed; environment state was not advanced.');
		await deploymentCurrent(root, plan, { ...guard, phase: ' during deployment' });
		const receipt = {
			configuration: deploymentProof(config),
			...deployed,
			environment: plan.environment,
			commit: plan.commit,
			branch: plan.branch,
			adapter: this.plugin.id,
			updatedAt: new Date().toISOString()
		};
		await saveDeployment(root, receipt);
		return receipt;
	}
	private root(input: ProjectContext): string {
		this.session.assertProject(input.projectId);
		if (!this.session.root) throw new Error('Select a local project first.');
		return this.session.root;
	}
}
