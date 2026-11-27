// @harness-uid u_okueohjk4j
import type {
	HomeMessage,
	HomePastDue
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

const pastDueLabels = { running: 'Running', queued: 'Queued', blocked: 'Blocked' } as const;

export function pastDueLabel(run: Pick<HomePastDue, 'state' | 'position'>) {
	return run.position ? `Queued #${run.position}` : pastDueLabels[run.state];
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
