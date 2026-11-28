import type { PlanLaunch } from './placeTrackerAutoLaunch.types';
// @harness-uid u_jey45slspx
import { trackerDesktopLaunchHost, trackerLaunchPlacement } from './trackerLaunchPlacement';
import type { TrackerFleetView } from './trackerLaunchPlacement.types';

/**
 * Place requests with no computer preference before planning the launch. An existing queue
 * keeps its target. Desktop work queues on the primary Mac even when its slots are busy.
 */
export function placeTrackerAutoLaunch(plan: PlanLaunch, view: TrackerFleetView): PlanLaunch {
	return (fields, current, source) => {
		const requested = String(fields.computer ?? current?.computer ?? 'auto')
			.trim()
			.toLowerCase();
		if (requested && requested !== 'auto') return plan(fields, current, source);
		const queued = current?.auto ? (current.launch_target ?? current.computer) : undefined;
		const item = launchSubject({ ...current, ...fields });
		const placed =
			queued ??
			(item.repo ? undefined : trackerDesktopLaunchHost(item)) ??
			trackerLaunchPlacement(item, view)?.node;
		return plan(placed ? { ...fields, computer: placed } : fields, current, source);
	};
}

function launchSubject(fields: Parameters<PlanLaunch>[0]) {
	const text = (value: unknown) => (typeof value === 'string' ? value : null);
	const { title, notes, project, agent, model, repo, sensitive } = fields;
	return {
		title: text(title),
		notes: text(notes),
		project: text(project),
		agent: text(agent),
		model: text(model),
		repo: text(repo),
		sensitive: Boolean(sensitive)
	};
}
