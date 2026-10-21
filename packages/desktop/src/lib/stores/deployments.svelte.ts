import { untrack } from 'svelte';
import type { Workspace } from './workspace.svelte';
import type {
	DeploymentEnvironment,
	DeploymentPlan,
	DeploymentStatus
} from '../../models/Deployment.types';
class DeploymentsState {
	environment = $state<DeploymentEnvironment>('dev');
	viewing = $state(false);
	statuses = $state<DeploymentStatus[]>([]);
	loading = $state(false);
	error = $state('');
	plan = $state<DeploymentPlan | null>(null);
	private jobId = $state<string | null>(null);
	private reviewing = $state(false);
	private starting = $state(false);
	private serial = 0;
	private owner: string | null = null;
	constructor(private workspace: Workspace) {}
	get selected() {
		return this.statuses.find((item) => item.environment === this.environment);
	}
	get job() {
		return this.workspace.activity?.items.find((item) => item.id === this.jobId) ?? null;
	}
	receipt = $derived(this.job?.receipt ?? null);
	get pending() {
		return this.reviewing || this.starting || Boolean(this.job && !this.job.finishedAt);
	}
	get supported() {
		const { workspace } = this;
		return Boolean(
			workspace.local &&
			!workspace.offline &&
			workspace.capabilities.agents &&
			workspace.bridge?.planDeployment &&
			workspace.bridge?.startDeployment &&
			workspace.bridge?.deploymentActivities
		);
	}
	choose(value: DeploymentEnvironment) {
		this.environment = value;
		this.viewing = true;
	}
	clear() {
		this.plan = null;
		this.error = '';
		if (this.job?.finishedAt) this.jobId = null;
	}
	async load() {
		if (this.owner !== this.workspace.projectId) {
			this.owner = this.workspace.projectId;
			this.environment = 'dev';
			this.viewing = false;
			this.jobId = null;
			untrack(() => {
				this.statuses = [];
				this.clear();
			});
		}
		return this.refresh();
	}
	async refresh() {
		const token = ++this.serial,
			{ bridge, projectId } = this.workspace;
		this.loading = true;
		try {
			const value =
				bridge?.deploymentStatus && projectId ? await bridge.deploymentStatus({ projectId }) : [];
			if (token === this.serial && projectId === this.workspace.projectId) this.statuses = value;
		} catch (error) {
			if (token === this.serial) this.error = String(error);
		} finally {
			if (token === this.serial) this.loading = false;
		}
	}
	async review() {
		if (!this.supported || !this.workspace.snapshot || this.pending) return;
		const projectId = this.workspace.projectId;
		this.reviewing = true;
		this.clear();
		this.jobId = null;
		try {
			const plan = await this.workspace.bridge!.planDeployment!({
				...this.workspace.context,
				environment: 'prod',
				commit: this.workspace.snapshot.revision.commit
			});
			if (projectId === this.workspace.projectId) this.plan = plan;
		} catch (error) {
			if (projectId === this.workspace.projectId) this.error = String(error);
		} finally {
			this.reviewing = false;
		}
	}
	async execute() {
		const plan = this.plan;
		if (!plan || !this.canStart(plan)) return;
		const projectId = this.workspace.projectId;
		this.starting = true;
		this.error = '';
		try {
			const job = await this.workspace.bridge!.startDeployment!({
				...this.workspace.context,
				planId: plan.id
			});
			this.workspace.activity.remember(job);
			if (projectId === this.workspace.projectId) this.jobId = job.id;
		} catch (error) {
			if (projectId === this.workspace.projectId) this.error = String(error);
		} finally {
			this.starting = false;
			if (projectId === this.workspace.projectId) this.plan = null;
		}
	}
	private canStart(plan: DeploymentPlan) {
		return (
			this.supported &&
			!this.workspace.busy &&
			!this.pending &&
			plan.environment === 'prod' &&
			plan.blockers.length === 0
		);
	}
}
export function createDeploymentsStore(workspace: Workspace) {
	return new DeploymentsState(workspace);
}
