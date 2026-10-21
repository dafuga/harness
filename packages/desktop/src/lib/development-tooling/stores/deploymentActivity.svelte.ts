import type { Workspace } from '../../stores/workspace.svelte';
import type { DeploymentActivity } from '../../../models/development-tooling/Deployment.types';
import { watchDeploymentActivities } from '../../../utils/development-tooling/watchDeploymentActivities';
/** All desktop deployments, independent of the project being browsed. */
class DeploymentActivityState {
	items = $state<DeploymentActivity[]>([]);
	error = $state('');
	private version = 0;
	constructor(private workspace: Workspace) {}
	get activeCount() {
		return this.items.filter((item) => !item.finishedAt).length;
	}
	remember(job: DeploymentActivity) {
		this.version++;
		this.items = [job, ...this.items.filter((item) => item.id !== job.id)];
	}
	watch() {
		return watchDeploymentActivities(this.workspace, {
			version: () => this.version,
			received: (items, version) => this.receive(items, version),
			failed: (message) => {
				this.error = message;
			}
		});
	}
	private receive(items: DeploymentActivity[], version: number) {
		if (version !== this.version) return;
		const previous = new Map(this.items.map((item) => [item.id, item.finishedAt]));
		this.items = items;
		this.error = '';
		if (
			items.some(
				(job) =>
					job.projectId === this.workspace.projectId &&
					job.finishedAt &&
					job.finishedAt !== previous.get(job.id)
			)
		)
			void this.workspace.deployments?.refresh();
	}
}
export function createDeploymentActivityStore(workspace: Workspace) {
	return new DeploymentActivityState(workspace);
}
