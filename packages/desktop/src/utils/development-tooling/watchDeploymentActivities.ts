import type { Events } from './watchDeploymentActivities.types';
import type { Workspace } from '../../lib/stores/workspace.svelte';
/** One host-wide read survives project navigation; stale connector replies never replace new jobs. */
export function watchDeploymentActivities(workspace: Workspace, events: Events) {
	let active = true,
		reading = false;
	const current = (bridge: Workspace['bridge']) =>
		active && workspace.local && workspace.bridge === bridge;
	async function poll() {
		if (!active || reading) return;
		const bridge = workspace.bridge,
			version = events.version();
		if (!workspace.local || !bridge?.deploymentActivities) return;
		reading = true;
		try {
			const items = await bridge.deploymentActivities();
			if (current(bridge)) events.received(items, version);
		} catch {
			if (current(bridge))
				events.failed('Deployment status is unavailable. Showing the last known deployments.');
		} finally {
			reading = false;
		}
	}
	void poll();
	const timer = setInterval(() => void poll(), 500);
	return () => {
		active = false;
		clearInterval(timer);
	};
}
