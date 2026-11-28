// @harness-uid u_bl6xl2h4a3
import { isOutageAlert } from './trackerCosAlertKinds';
import { trackerCosDeliveryAskTitle } from '../../../utils/projects-sessions/trackerStructuredAsk';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

const listed = 12;

// The wording must stay clear of `isTrackerCosMessage`, or the ask is hidden from Daniel.
const options = JSON.stringify([
	{
		label: 'Check Chief of Staff',
		effect:
			'Check the cos session on the primary Mac. Restore it if it is missing or stalled. The reminder closes once the waiting alerts are delivered.',
		recommended: true
	},
	{
		label: 'Leave it for now',
		effect: 'Alerts stay queued. You are asked again in 4 hours if they are still waiting.'
	}
]);

export const cosDeliveryDelivered = {
	status: 'done',
	needs_daniel: 0,
	resolved: 1,
	'note+': 'Alert delivery caught up; this closed automatically.'
};

export function cosDeliveryAsk({
	pending,
	now,
	node,
	created
}: {
	pending: readonly TrackerWatchdogAlert[];
	now: number;
	node: string;
	created: boolean;
}) {
	const outages = pending.filter(({ kind }) => isOutageAlert(kind));
	const minutes = Math.floor((now - Math.min(...pending.map(({ at }) => at))) / 60_000);
	const count = `${pending.length} Tracker ${pending.length === 1 ? 'alert has' : 'alerts have'}`;
	return {
		...(created && {
			title: trackerCosDeliveryAskTitle,
			kind: 'reminder',
			priority: 'urgent',
			created_at: new Date(now).toISOString(),
			created_by: node,
			schedule_off: 1,
			deleted: 0
		}),
		status: 'open',
		needs_daniel: 1,
		resolved: 0,
		answer: null,
		answer_option: null,
		answered_at: null,
		answered_by: null,
		question: `${count} not reached your Chief of Staff session (oldest waiting ${minutes} minutes; ${outages.length} outage or security). The Tracker can only send them to a tmux session named "cos" on the primary Mac. What should happen?`,
		options,
		'note+': waitingList(outages.length ? outages : pending)
	};
}

function waitingList(alerts: readonly TrackerWatchdogAlert[]) {
	const lines = alerts
		.slice(0, listed)
		.map(({ item_id, host, kind }) => `[${item_id.slice(0, 6)}] ${host} ${kind}`);
	const more = alerts.length > listed ? `; and ${alerts.length - listed} more` : '';
	return `Waiting alerts (full text: tracker needs-attention): ${lines.join('; ')}${more}`;
}
