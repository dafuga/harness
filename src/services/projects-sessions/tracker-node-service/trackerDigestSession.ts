// @harness-uid u_gvqtr5mdwv
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import { WatchdogPaneService } from '../WatchdogPaneService';
import type {
	TrackerDeliveryRequest,
	TrackerDeliveryResult
} from '../TrackerNotificationService.types';
import type { TrackerNodeSessionTarget } from './trackerNodeConfig.types';

/** The tmux adapter refuses longer messages. */
const messageLimit = 5000;
const panes = new WatchdogPaneService();

/** Type one digest into a Claude Code or Codex tmux session, only while its composer is idle. */
export function trackerDigestSession(
	{ cli, session, tmux: executable }: TrackerNodeSessionTarget,
	node: string
) {
	return async (request: TrackerDeliveryRequest): Promise<TrackerDeliveryResult> => {
		const tmux = new TrackerTmuxAdapter({ executable, node });
		const signal = AbortSignal.timeout(20_000);
		const names = new RegExp(`^${session}$`);
		const found = await tmux.scan(signal, names);
		if (found.length !== 1 || panes.idlePrompt(found[0]) !== cli)
			return { status: 'rejected', error: 'Digest session is not idle', busy: true };
		const message = digestMessage(request);
		return (await tmux.nudge({ pane: found[0], cli, message, names }, signal))
			? { status: 'sent' }
			: { status: 'rejected', error: 'Digest session did not accept the digest' };
	};
}

/** One line without control characters; a long digest is cut but keeps its suggestion. */
function digestMessage({ id, body }: TrackerDeliveryRequest): string {
	const { text, suggestion } = JSON.parse(body) as { text?: string; suggestion?: string };
	const head = 'Tracker digest (automated, not typed by Daniel): ';
	const tail = `${suggestion ? ` Until the next digest: ${oneLine(suggestion)}.` : ''} Reference ${id}.`;
	const lines = (text ?? 'Open the Tracker digest.')
		.split('\n')
		.filter((line) => !suggestion || line !== `Until the next digest: ${suggestion}`)
		.map(oneLine)
		.join(' | ');
	const room = messageLimit - head.length - tail.length;
	const cut = ' ... digest shortened; run tracker digest.';
	const shown = lines.length > room ? lines.slice(0, room - cut.length) + cut : lines;
	return oneLine(head + shown + tail);
}

function oneLine(text: string): string {
	return text.replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]+/gu, ' ').trim();
}
