import { deploymentExecution } from '../utils/deploymentExecution';
import { randomUUID } from 'node:crypto';
import { CloudflareDeployAdapter } from '../adapters/CloudflareDeployAdapter';
import type {
	DeployExecutor,
	DeployInput,
	DeploymentPlan,
	DeploymentProgress,
	DeploymentPlugin,
	DeploymentQuery,
	CloudflareTarget
} from '../models/Deployment.types';
import type { ProjectContext } from '../models/ProjectContext.types';
import type { ProjectSessionService } from './ProjectSessionService';
import { deploymentBlockers, deploymentProof } from '../utils/deploymentProof';
import { deploymentStatus } from '../utils/deploymentState';
const deploymentSteps = [
	'Run bun run check',
	'Build the source commit',
	'Deploy with Cloudflare',
	'Verify deployment identity and health'
];
export interface DeploymentOptions {
	plugin?: DeploymentPlugin;
	execute?: DeployExecutor;
	health?: (target: CloudflareTarget) => Promise<boolean>;
}
export interface ReviewedDeployment {
	plan: DeploymentPlan;
	fingerprint: string;
	root: string;
	projectId: string | null;
}
/** Plans live in this desktop session; no renderer input supplies commands, targets or credentials. */
export class DeploymentService {
	private plans = new Map<string, ReviewedDeployment>();
	private updates = new Map<string, { root: string; value: DeploymentProgress }>();
	private plugin: DeploymentPlugin;
	constructor(
		private session: ProjectSessionService,
		private options: DeploymentOptions = {}
	) {
		this.plugin = options.plugin ?? new CloudflareDeployAdapter();
	}
	async status(input: ProjectContext = {}) {
		return deploymentStatus(this.root(input), this.plugin);
	}

	async plan(input: DeploymentQuery): Promise<DeploymentPlan> {
		const root = this.root(input);
		const config = await this.plugin.discover(root);
		const proof = await deploymentBlockers(root, input, config);
		const { blockers, branch } = proof;
		const target = config.targets[input.environment];
		const plan = {
			id: randomUUID(),
			environment: input.environment,
			commit: proof.promotion?.preprod?.commit ?? input.commit,
			...(proof.promotion ? { promotion: proof.promotion } : {}),
			branch,
			adapter: this.plugin.id,
			target: target
				? `${target.kind} · ${target.name} · ${target.wranglerEnvironment || target.branch} · account ${target.accountId} · ${target.healthUrl}`
				: 'Unconfigured',
			steps: deploymentSteps,
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
		if (!['dev', 'stage', 'preprod'].includes(input.environment))
			throw new Error('Protected environments require the Deploy UI.');
		const plan = await this.plan(input);
		const reviewed = this.plans.get(plan.id)!;
		this.plans.delete(plan.id);
		return this.execute(reviewed);
	}
	async progress(input: DeployInput) {
		const update = this.updates.get(input.planId);
		return update?.root === this.root(input) ? update.value : null;
	}
	private update(reviewed: ReviewedDeployment, phase: DeploymentProgress['phase'], detail: string) {
		if (this.updates.size >= 32) this.updates.delete(this.updates.keys().next().value!);
		this.updates.set(reviewed.plan.id, { root: reviewed.root, value: { phase, detail } });
	}
	private execute(reviewed: ReviewedDeployment) {
		return deploymentExecution(reviewed, {
			...this.options,
			plugin: this.plugin,
			update: (phase, detail) => this.update(reviewed, phase, detail)
		});
	}
	private root(input: ProjectContext): string {
		this.session.assertProject(input.projectId);
		if (!this.session.root) throw new Error('Select a local project first.');
		return this.session.root;
	}
}
