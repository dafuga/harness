// @harness-uid u_44qijhmp62
import { redactSecrets } from '../../utils/agents-providers/redactSecrets';
import type {
	TrackerDispatcherService,
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';

/** A bounded, redacted cause for a start call that threw. */
export function trackerStartError(message: string) {
	const reason = redactSecrets(message).slice(0, 500);
	return { type: 'startup-failed', pending: true, reason } as const;
}

/** The session may still appear, so a thrown start only records why none has yet. */
export async function awaitStartEvidence(
	{
		waits,
		dispatcher
	}: {
		waits: Map<string, { token: string; reason: string }>;
		dispatcher: TrackerDispatcherService;
	},
	run: TrackerRunReceipt,
	thrown: Extract<TrackerDispatchEvent, { type: 'startup-failed' }> | undefined
) {
	const cause = thrown ? `: ${thrown.reason}` : '';
	waits.set(run.item_id, {
		token: run.auto_token,
		reason: `waiting for host startup evidence${cause}`
	});
	if (thrown) await dispatcher.record(run.item_id, run, thrown);
	return false;
}
