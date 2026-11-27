// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import { watchdogEffectReceipt, watchdogScan } from './trackerHostWatchdogSchema';
import { trackerOverloadAlertKind, urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { readTrackerWatchdogPeer } from './trackerWatchdogPeer';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import { WatchdogPaneService } from '../WatchdogPaneService';

const panes = new WatchdogPaneService();

const transcriptOnlyPort: TrackerWatchdogPort = {
	scan: async () => null,
	nudge: async () => false,
	send: async () => false
};

export function trackerWatchdogPort(
	config: NonNullable<TrackerHostEffects['watchdog']>,
	node: string
): TrackerWatchdogPort {
	if ('tmux' in config)
		return tmuxPort(
			new TrackerTmuxAdapter({ executable: config.tmux, node }),
			config.chiefOfStaff === true && node === 'daniel-primary-mbp'
		);
	if (!('driver' in config)) return transcriptOnlyPort;
	const driver = new TrackerHostProcessAdapter(config.driver);
	return {
		async scan(signal) {
			return watchdogScan.parse(await driver.request('watchdog-scan', { node }, signal));
		},
		async nudge(input, signal) {
			return watchdogEffectReceipt.parse(
				await driver.request('watchdog-nudge', { node, ...input }, signal)
			).sent;
		},
		async send(alerts, signal) {
			return watchdogEffectReceipt.parse(
				await driver.request('watchdog-cos', { node, alerts }, signal)
			).sent;
		}
	};
}

const minute = 60_000;
/** One message per half hour, sooner while more alerts than one message holds are waiting. */
const cosInterval = 30 * minute;
const backlogInterval = 5 * minute;

/** The pane input refuses long messages, so the slot lines take only the room that is left. */
const cosMessageLimit = 5000;

function cosMessage(summary: readonly string[], alerts: readonly TrackerWatchdogAlert[]) {
	const message =
		'Tracker watchdog alerts for Chief of Staff. Review these items. ' + summary.join(' | ');
	const slots = new Map(
		alerts.flatMap(({ host, slots }) => (slots ? [[host, plain(slots)] as const] : []))
	);
	if (!slots.size) return message;
	const lines = [...slots].map(([host, line]) => `${host}: ${line}`);
	return `${message} || Slots by computer: ${lines.join(' || ')}`.slice(0, cosMessageLimit);
}

function plain(text: string) {
	return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ');
}

function tmuxPort(tmux: TrackerTmuxAdapter, chiefOfStaff: boolean): TrackerWatchdogPort {
	let nextCosTick = 0;
	return {
		...(chiefOfStaff && { peers: readTrackerWatchdogPeer }),
		close: (input, signal) => tmux.closeIdle(input, signal),
		scan: (signal) => tmux.scan(signal),
		inventory: (signal) => tmux.inventory(signal),
		nudge: (input, signal) => tmux.nudge(input, signal),
		deliver: (input, signal) => deliverToSession(tmux, input, signal),
		async send(alerts, signal, queue) {
			const now = Date.now();
			const healthOnly = alerts.every(({ kind }) => kind === trackerOverloadAlertKind);
			if (!healthOnly && !canSendRoutine(alerts, now, nextCosTick)) return false;
			const panes = await tmux.scan(signal, /^cos$/);
			if (panes.length !== 1) return false;
			const summary = alerts.map(
				({ item_id, host, reason }) =>
					`[${item_id.slice(0, 6)}] ${host}: ${plain(reason).slice(0, 500)}`
			);
			const message = cosMessage(summary, alerts);
			const sent = await tmux.nudge({ pane: panes[0], cli: 'claude', message }, signal);
			if (sent && !healthOnly) nextCosTick = now + (queue?.backlog ? backlogInterval : cosInterval);
			return sent;
		}
	};
}

function canSendRoutine(alerts: readonly TrackerWatchdogAlert[], now: number, nextCosTick: number) {
	return (
		cosSendWindowStart(now) !== null &&
		(now >= nextCosTick || alerts.some(({ kind }) => kind === urgentQueueAlertKind))
	);
}

/** Only one pane of exactly that name, and only while its prompt is empty and waiting. */
async function deliverToSession(
	tmux: TrackerTmuxAdapter,
	{ session, message, expected }: Parameters<NonNullable<TrackerWatchdogPort['deliver']>>[0],
	signal: AbortSignal
): Promise<'delivered' | 'busy' | 'missing'> {
	if (!/^[A-Za-z0-9._-]{1,100}$/.test(session)) return 'missing';
	const names = new RegExp(`^${session.replace(/[.]/g, '\\.')}$`);
	const found = await tmux.scan(signal, names);
	const [pane] = found;
	if (found.length !== 1 || !matchesAnswerPane(pane, expected)) return 'missing';
	const cli = panes.idlePrompt(pane);
	if (!cli || (expected && expected.cli !== cli)) return 'busy';
	return (await tmux.nudge({ pane, cli, message, names }, signal)) ? 'delivered' : 'busy';
}

function matchesAnswerPane(
	pane: WatchdogPane,
	expected: Parameters<NonNullable<TrackerWatchdogPort['deliver']>>[0]['expected']
) {
	if (!expected) return true;
	const { startedAt, key } = expected;
	return (
		startedAt >= pane.createdAt - 1000 &&
		startedAt <= pane.createdAt + 60_000 &&
		(!key || key === pane.key)
	);
}
