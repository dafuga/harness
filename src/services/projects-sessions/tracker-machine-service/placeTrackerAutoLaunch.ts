import type { PlanLaunch } from './placeTrackerAutoLaunch.types';
// @harness-uid u_jey45slspx
import { trackerLaunchPlacement } from './trackerLaunchPlacement';
import type { TrackerFleetView } from './trackerLaunchPlacement.types';

/**
 * Resolve an explicit `--computer auto` before the launch is planned. A request already queued
 * keeps its computer. With no known fit the plan keeps its own default, this computer.
 */
export function placeTrackerAutoLaunch(plan: PlanLaunch, view: TrackerFleetView): PlanLaunch {
	return (fields, current, source) => {
		if (
			String(fields.computer ?? '')
				.trim()
				.toLowerCase() !== 'auto'
		)
			return plan(fields, current, source);
		const queued = current?.auto ? (current.launch_target ?? current.computer) : undefined;
		const placed =
			queued ?? trackerLaunchPlacement(launchSubject({ ...current, ...fields }), view)?.node;
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
