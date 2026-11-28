// @harness-uid u_okueohjk4j
import type {
	OverviewSnapshot,
	OverviewItem
} from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type {
	HomeMessage,
	HomePastDue
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

const pastDueLabels = {
	running: 'Running',
	queued: 'Queued',
	due: 'Due now',
	blocked: 'Blocked'
} as const;

export function pastDueLabel(run: Pick<HomePastDue, 'state' | 'position'>) {
	return run.position ? `Queued #${run.position}` : pastDueLabels[run.state];
}

/** The task type that selects an item's model, as Home shows it beside the model. */
export function taskTypeText(type: string | null | undefined) {
	return type ? `${type} task` : null;
}

/** A current work badge on Home, including the reported blocker. */
export function currentWorkLabel(run: HomePastDue) {
	return [pastDueLabel(run), run.state === 'blocked' && run.reason].filter(Boolean).join(' · ');
}

export function pastDueSummary(runs: HomePastDue[]) {
	return (Object.keys(pastDueLabels) as HomePastDue['state'][])
		.map((state) => ({ state, total: runs.filter((run) => run.state === state).length }))
		.filter(({ total }) => total)
		.map(({ state, total }) => `${total} ${pastDueLabels[state].toLowerCase()}`)
		.join(' · ');
}

/** Where one of Daniel's Hub messages got to, in his words; nothing for plain notes. */
export function messageStatusText(
	message: Pick<HomeMessage, 'status' | 'reason'>,
	name: string
): string | null {
	if (message.status === 'stored')
		return message.reason ? `Not delivered yet: ${message.reason}` : 'Stored in Tracker';
	if (message.status === 'delivered') return `Delivered to ${name}`;
	if (message.status === 'acknowledged') return 'Replied';
	if (message.status === 'refused')
		return message.reason ? `Not delivered: ${message.reason}` : 'Not delivered';
	return null;
}

/** Adds the same current work state to Home rows, project callouts, and item detail. */
export function workOverview(
	value: OverviewSnapshot | null,
	pastDue: HomePastDue[]
): OverviewSnapshot | null {
	if (value?.status !== 'ready') return value;
	const states = new Map(pastDue.map((run) => [run.id, currentWorkLabel(run)]));
	const withState = (item: OverviewItem) => ({ ...item, workLabel: states.get(item.id) });
	return {
		...value,
		projects: value.projects.map((project) => ({
			...project,
			items: project.items.map(withState),
			blocked: project.blocked && { ...project.blocked, item: withState(project.blocked.item) },
			attention: project.attention && {
				...project.attention,
				item: withState(project.attention.item)
			}
		}))
	};
}
