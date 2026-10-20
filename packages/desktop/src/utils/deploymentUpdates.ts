import type { Workspace } from '../lib/stores/workspace.svelte';
import type { DeploymentProgress } from '../models/Deployment.types';
/** Polling uses the same project-scoped bridge, without exposing commands or provider output. */
export function deploymentUpdates(
	workspace: Workspace,
	planId: string,
	update: (value: DeploymentProgress) => void
) {
	const { bridge, projectId } = workspace;
	const read = bridge?.deploymentProgress;
	let active = true;
	const current = () => active && projectId === workspace.projectId;
	let reading = false;
	async function poll() {
		if (!current() || reading || !read) return;
		reading = true;
		try {
			const value = await read({ projectId: projectId ?? undefined, planId });
			if (value && current()) update(value);
		} catch {
			/* The deployment result remains authoritative if a progress read fails. */
		} finally {
			reading = false;
		}
	}
	const timer = setInterval(() => void poll(), 200);
	return () => {
		active = false;
		clearInterval(timer);
	};
}
