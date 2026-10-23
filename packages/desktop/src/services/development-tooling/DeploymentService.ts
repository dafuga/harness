import type { ReviewedDeployment, DeploymentOptions } from './DeploymentService.types';
import { CloudflareDeployAdapter } from '../../adapters/development-tooling/CloudflareDeployAdapter';
import { desktopDeployments } from './DeploymentActivityService';
import type { DeploymentActivityService } from './DeploymentActivityService';
import type {
	DeployInput,
	DeploymentPlugin,
	DeploymentQuery
} from '../../models/development-tooling/Deployment.types';
import type { ProjectContext } from '../../models/ProjectContext.types';
import type { ProjectSessionService } from '../ProjectSessionService';
import { deploymentCurrent } from '../../utils/development-tooling/deploymentProof';
import { deploymentStatus } from '../../utils/development-tooling/deploymentState';
import { deploymentExecution } from '../../utils/development-tooling/deploymentExecution';
import { reviewDeployment } from '../../utils/development-tooling/reviewDeployment';
import { enqueueChangeDeployments } from '../../utils/development-tooling/enqueueChangeDeployments';
/** Read-only plans and short admissions; every actual deployment belongs to the host job registry. */
export class DeploymentService {
	private plans = new Map<string, ReviewedDeployment>();
	private plugin: DeploymentPlugin;
	private jobs: DeploymentActivityService;
	constructor(
		private session: ProjectSessionService,
		private options: DeploymentOptions = {}
	) {
		this.plugin = options.plugin ?? new CloudflareDeployAdapter();
		this.jobs = options.activities ?? desktopDeployments;
	}
	status(input: ProjectContext = {}) {
		return deploymentStatus(this.root(input), this.plugin);
	}
	activities() {
		return this.jobs.list();
	}
	async plan(input: DeploymentQuery) {
		const reviewed = await reviewDeployment(this.root(input), input, {
			plugin: this.plugin,
			projectId: this.session.projectId
		});
		for (const [id, value] of this.plans)
			if (Date.parse(value.plan.expiresAt) <= Date.now()) this.plans.delete(id);
		if (this.plans.size >= 32) this.plans.delete(this.plans.keys().next().value!);
		this.plans.set(reviewed.plan.id, reviewed);
		return structuredClone(reviewed.plan);
	}
	async start(input: DeployInput) {
		const reviewed = this.plans.get(input.planId);
		this.plans.delete(input.planId);
		if (!reviewed || Date.parse(reviewed.plan.expiresAt) <= Date.now())
			throw new Error('Please review a fresh deployment plan.');
		if (this.root(input) !== reviewed.root || this.session.projectId !== reviewed.projectId)
			throw new Error('The selected project changed.');
		await deploymentCurrent(reviewed.root, reviewed.plan, {
			plugin: this.plugin,
			fingerprint: reviewed.fingerprint
		});
		return this.jobs.schedule(reviewed, (update) =>
			deploymentExecution(reviewed, { ...this.options, plugin: this.plugin, update })
		);
	}
	async deploy(input: DeployInput) {
		return this.jobs.wait((await this.start(input)).id);
	}
	async automatic(input: DeploymentQuery) {
		if (!['dev', 'stage', 'preprod'].includes(input.environment))
			throw new Error('Production requires the Deploy UI.');
		return this.deploy({ ...input, planId: (await this.plan(input)).id });
	}
	enqueue(input: DeploymentQuery) {
		return enqueueChangeDeployments(
			this.root(input),
			{ ...input, projectId: this.session.projectId },
			{ ...this.options, plugin: this.plugin, activities: this.jobs }
		);
	}
	async progress(input: DeployInput) {
		return this.jobs.progress(input.planId, this.root(input));
	}
	private root(input: ProjectContext): string {
		this.session.assertProject(input.projectId);
		if (!this.session.root) throw new Error('Select a local project first.');
		return this.session.root;
	}
}

export type { DeploymentOptions, ReviewedDeployment } from './DeploymentService.types';
