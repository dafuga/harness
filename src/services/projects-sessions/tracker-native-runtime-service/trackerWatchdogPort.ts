// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import { watchdogEffectReceipt, watchdogScan } from './trackerHostWatchdogSchema';
import { readTrackerWatchdogPeer } from './trackerWatchdogPeer';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

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

function tmuxPort(tmux: TrackerTmuxAdapter, chiefOfStaff: boolean): TrackerWatchdogPort {
	const lisbon = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Lisbon',
		hour: 'numeric',
		hourCycle: 'h23'
	});
	let nextCosTick = 0;
	return {
		...(chiefOfStaff && { peers: readTrackerWatchdogPeer }),
		close: (input, signal) => tmux.closeIdle(input, signal),
		scan: (signal) => tmux.scan(signal),
		inventory: (signal) => tmux.inventory(signal),
		nudge: (input, signal) => tmux.nudge(input, signal),
		async send(alerts, signal) {
			const now = Date.now();
			const hour = Number(lisbon.format(now));
			if (hour < 8 || hour >= 22 || now < nextCosTick) return false;
			const panes = await tmux.scan(signal, /^cos$/);
			if (panes.length !== 1) return false;
			const summary = alerts.map(
				({ item_id, host, reason }) =>
					`[${item_id.slice(0, 6)}] ${host}: ${reason.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').slice(0, 500)}`
			);
			const message =
				'Tracker watchdog alerts for Chief of Staff. Review these items. ' + summary.join(' | ');
			const sent = await tmux.nudge({ pane: panes[0], cli: 'claude', message }, signal);
			if (sent) nextCosTick = now + 30 * 60_000;
			return sent;
		}
	};
}
