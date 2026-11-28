// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import { readClaudeCosReceipts } from '../../../adapters/projects-sessions/tracker-tmux-adapter/readClaudeCosReceipt';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import { watchdogEffectReceipt, watchdogScan } from './trackerHostWatchdogSchema';
import { staleDispatchHeartbeatKind } from './trackerCosAlertKinds';
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { readTrackerWatchdogPeer } from './trackerWatchdogPeer';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { cosReceiptReference } from './trackerHostCos';

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

/** The 80x24 CoS pane showed about 500 bytes before scrolling. Leave room for wrapping. */
const cosMessageLimit = 450;
const cosBatchLimit = 4;
const cosAlertLineLimit = 112;
const rowSeparator = ' | ';

function cosMessage(alerts: readonly TrackerWatchdogAlert[]) {
	const slots = new Map(
		alerts.flatMap(({ host, slots }) => (slots ? [[host, plain(slots)] as const] : []))
	);
	if (!slots.size) return cosSummary(alerts);
	const lines = [...slots].map(([host, line]) => `${host}: ${line}`);
	const withSlots = cosSummary(alerts, ` || Slots by computer: ${lines.join(' || ')}`);
	return Buffer.byteLength(withSlots) <= cosMessageLimit ? withSlots : cosSummary(alerts);
}

function plain(text: string) {
	return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ');
}

function tmuxPort(tmux: TrackerTmuxAdapter, chiefOfStaff: boolean): TrackerWatchdogPort {
	let nextCosTick = 0;
	return {
		batchLimit: cosBatchLimit,
		...(chiefOfStaff && { peers: readTrackerWatchdogPeer }),
		close: (input, signal) => tmux.closeIdle(input, signal),
		scan: (signal) => tmux.scan(signal),
		inventory: (signal) => tmux.inventory(signal),
		nudge: (input, signal) => tmux.nudge(input, signal),
		deliver: (input, signal) => deliverToSession(tmux, input, signal),
		async receipts(alerts, signal) {
			const found = await tmux.scan(signal, /^cos$/);
			return readClaudeCosReceipts(
				found.length === 1 ? found[0].cwd : undefined,
				alerts.map((alert) => ({
					id: alert.id,
					line: cosAlertLine(alert),
					reference: cosReceiptReference(alert),
					since: alert.at
				}))
			);
		},
		async send(alerts, signal, queue) {
			const now = Date.now();
			if (cosSendWindowStart(now) === null) return false;
			const [pane, extra] = await tmux.scan(signal, /^cos$/);
			if (!pane?.ready || extra) return false;
			if (panes.idlePrompt(pane) !== 'claude') return workingCosPane(pane) ? 'deferred' : false;
			if (now < nextCosTick && !alerts.some(bypassesCosCadence)) return 'deferred';
			const message = cosMessage(alerts);
			const sent = await tmux.nudge({ pane, cli: 'claude', message }, signal);
			if (sent) nextCosTick = now + (queue?.backlog ? backlogInterval : cosInterval);
			return sent;
		}
	};
}

function bypassesCosCadence({ kind }: TrackerWatchdogAlert) {
	return kind === urgentQueueAlertKind || kind === staleDispatchHeartbeatKind;
}

function workingCosPane({ screen, y }: WatchdogPane) {
	return /\b(?:esc to interrupt|ctrl\+c to interrupt)\b/i.test(
		screen
			?.split('\n')
			.slice(Math.max(0, y - 5), y + 4)
			.join('\n') ?? ''
	);
}

function cosSummary(alerts: readonly TrackerWatchdogAlert[], trailer = '') {
	const references = alerts.map(cosReceiptReference).join(',');
	const prefix =
		'Tracker watchdog alerts for Chief of Staff. Review these items. ' +
		`Watchdog receipts: ${references} || `;
	const available =
		cosMessageLimit -
		Buffer.byteLength(prefix) -
		Buffer.byteLength(trailer) -
		(alerts.length - 1) * rowSeparator.length;
	const lineBudget = Math.min(cosAlertLineLimit, Math.floor(available / alerts.length));
	return (
		prefix + alerts.map((alert) => cosPromptLine(alert, lineBudget)).join(rowSeparator) + trailer
	);
}

function cosPromptLine(alert: TrackerWatchdogAlert, budget: number) {
	const full = cosAlertLine(alert);
	if (Buffer.byteLength(full) <= budget) return full;
	const id = cosAlertPrefix(alert);
	const sentence = /^.*?[.!?](?=\s|$)/u.exec(plain(alert.reason).trim())?.[0];
	if (sentence && Buffer.byteLength(id + sentence) <= budget) return id + sentence;
	return id + 'See the full alert in Tracker.';
}

/** Rendered rows from before references and the composer budget are used to recover old receipts. */
function cosAlertLine(alert: TrackerWatchdogAlert) {
	return `${cosAlertPrefix(alert, true)}${plain(alert.reason).slice(0, 500)}`;
}

function cosAlertPrefix({ item_id, kind, host }: TrackerWatchdogAlert, includeHost = false) {
	const scheduler = kind === staleDispatchHeartbeatKind;
	const label = scheduler ? 'scheduler' : item_id.slice(0, 6);
	return `[${label}] ${scheduler || includeHost ? `${host}: ` : ''}`;
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
