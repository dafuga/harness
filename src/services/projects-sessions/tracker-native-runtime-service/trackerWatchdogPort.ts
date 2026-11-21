// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import { watchdogEffectReceipt, watchdogScan } from './trackerHostWatchdogSchema';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

export function trackerWatchdogPort(
	config: NonNullable<TrackerHostEffects['watchdog']>,
	node: string
): TrackerWatchdogPort {
	if ('tmux' in config) return tmuxPort(new TrackerTmuxAdapter({ executable: config.tmux, node }));
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

function tmuxPort(tmux: TrackerTmuxAdapter): TrackerWatchdogPort {
	return {
		scan: (signal) => tmux.scan(signal),
		nudge: (input, signal) => tmux.nudge(input, signal),
		async send(alerts, signal) {
			const panes = await tmux.scan(signal, /^cos$/);
			if (panes.length !== 1) return false;
			const summary = alerts.map(
				({ item_id, host, reason }) =>
					`[${item_id.slice(0, 6)}] ${host}: ${reason.replace(/\p{Cc}+/gu, ' ').slice(0, 500)}`
			);
			const message =
				'Tracker watchdog alerts for Chief of Staff. Review these items. ' + summary.join(' | ');
			return tmux.nudge({ pane: panes[0], cli: 'claude', message }, signal);
		}
	};
}
