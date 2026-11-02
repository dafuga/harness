import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';

export type DeploymentLight = 'active' | 'failed' | 'recent' | 'idle' | 'queued';

const destination = (item: DeploymentActivity) => `${item.projectId}:${item.environment}`;

/** @pure Failed deployments that stand: none is followed by a newer one to the same destination. */
export function standingFailures(items: DeploymentActivity[]): number {
	const newest = (item: DeploymentActivity) =>
		items.find((one) => destination(one) === destination(item)) === item;
	return items.filter((item) => item.phase === 'failed' && newest(item)).length;
}

/** @pure The count of active deployments, with the failures that stand. */
export function activitySummary(activeCount: number, failed: number): string {
	const running = `${activeCount || 'No'} active deployment${activeCount === 1 ? '' : 's'}`;
	return failed ? `${running} · ${failed} failed` : running;
}

/** @pure Idle ring, dot after a deployment, diamond after a failure, haloed dot while one is under way. */
export function activityLight(activeCount: number, failed: number, total: number): DeploymentLight {
	if (activeCount) return 'active';
	if (failed) return 'failed';
	return total ? 'recent' : 'idle';
}

/** @pure Where a deployment is: queued, deployed, the step it failed at, or the step under way. */
export function phaseLabel(item: DeploymentActivity): string {
	const step = item.steps.find((one) => one.id === item.step)?.title;
	if (item.phase === 'queued') return 'Queued';
	if (item.phase === 'complete') return 'Deployed';
	if (item.phase === 'failed') return step ? `Failed at ${step}` : 'Failed';
	return step ?? 'Starting';
}

/** @pure The light one deployment shows in the list. */
export function itemLight(item: DeploymentActivity): DeploymentLight {
	if (item.phase === 'queued' || item.phase === 'failed') return item.phase;
	return item.phase === 'complete' ? 'recent' : 'active';
}
