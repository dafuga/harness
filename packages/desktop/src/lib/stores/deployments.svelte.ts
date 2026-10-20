import { deploymentUpdates } from '../../utils/deploymentUpdates';
import { untrack } from 'svelte';
import type { Workspace } from './workspace.svelte';
import type {
	DeploymentEnvironment,
	DeploymentProgress,
	DeploymentPlan,
	DeploymentReceipt,
	DeploymentStatus
} from '../../models/Deployment.types';
class DeploymentsState {
	environment = $state<DeploymentEnvironment>('dev');
	statuses = $state<DeploymentStatus[]>([]);
	loading = $state(false);
	pending = $state(false);
	progress = $state<DeploymentProgress | null>(null);
	error = $state('');
	plan = $state<DeploymentPlan | null>(null);
	receipt = $state<DeploymentReceipt | null>(null);
	private serial = 0;
	private owner: string | null = null;
	constructor(private workspace: Workspace) {}
	get selected() {
		return this.statuses.find((item) => item.environment === this.environment);
	}
	get supported() {
		return Boolean(
			this.workspace.local &&
			!this.workspace.offline &&
			this.workspace.capabilities.agents &&
			this.workspace.bridge?.planDeployment &&
			this.workspace.bridge?.deploy
		);
	}
	choose(value: DeploymentEnvironment) {
		this.environment = value;
		if (!this.pending) this.clear();
	}
	clear() {
		this.plan = null;
		this.receipt = null;
		this.error = '';
		this.progress = null;
	}
	async load() {
		const token = ++this.serial;
		const { bridge, projectId } = this.workspace;
		if (this.owner !== projectId) {
			this.environment = 'dev';
			this.owner = projectId;
		}
		untrack(() => {
			this.statuses = [];
			this.clear();
			this.loading = true;
		});
		try {
			const value =
				bridge?.deploymentStatus && projectId ? await bridge.deploymentStatus({ projectId }) : [];
			if (token === this.serial) this.statuses = value;
		} catch (error) {
			if (token === this.serial) this.error = String(error);
		} finally {
			if (token === this.serial) this.loading = false;
		}
	}
	async review() {
		if (!this.supported || !this.workspace.snapshot || this.pending) return;
		const projectId = this.workspace.projectId,
			environment = 'prod' as const;
		this.pending = true;
		this.clear();
		try {
			const plan = await this.workspace.bridge!.planDeployment!({
				...this.workspace.context,
				environment,
				commit: this.workspace.snapshot.revision.commit
			});
			if (projectId === this.workspace.projectId) this.plan = plan;
		} catch (error) {
			if (projectId === this.workspace.projectId) this.error = String(error);
		} finally {
			this.pending = false;
		}
	}
	async execute() {
		const plan = this.plan;
		if (!plan || !canExecute(this, this.workspace)) return;
		const projectId = this.workspace.projectId;
		this.pending = true;
		this.error = '';
		this.progress = { phase: 'preparing', detail: 'Preparing the preprod commit' };
		const stop = deploymentUpdates(this.workspace, plan.id, (value) => {
			this.progress = value;
		});
		try {
			const receipt = await this.workspace.bridge!.deploy!({
				...this.workspace.context,
				planId: plan.id
			});
			if (projectId !== this.workspace.projectId) return;
			await this.load();
			this.receipt = receipt;
			this.progress = { phase: 'complete', detail: 'Production is up to date' };
		} catch (error) {
			if (projectId === this.workspace.projectId) {
				this.error = String(error);
				this.progress = { phase: 'failed', detail: 'Promotion failed' };
			}
		} finally {
			stop();
			this.pending = false;
			this.plan = null;
		}
	}
}
export function createDeploymentsStore(workspace: Workspace) {
	return new DeploymentsState(workspace);
}

function canExecute(store: DeploymentsState, workspace: Workspace) {
	const plan = store.plan;
	return Boolean(
		store.supported &&
		!workspace.busy &&
		plan &&
		!store.pending &&
		plan.blockers.length === 0 &&
		plan.environment === 'prod'
	);
}
