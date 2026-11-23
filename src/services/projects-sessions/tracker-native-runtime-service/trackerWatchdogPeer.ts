// @harness-uid u_bl6xl2h4a3
import { runTrackerHostCommand } from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import { trackerWatchdogAlerts } from './trackerHostWatchdogSchema';

const peer = 'harbor-mbp-2';

/** Read MB2's local attention list over the existing pinned SSH connection. */
export async function readTrackerWatchdogPeer(signal: AbortSignal) {
	try {
		const result = await runTrackerHostCommand(
			'/usr/bin/ssh',
			[
				'-o',
				'BatchMode=yes',
				'-o',
				'StrictHostKeyChecking=yes',
				'-o',
				'ConnectTimeout=4',
				peer,
				'"$HOME/.local/bin/tracker" watchdog alerts --json'
			],
			AbortSignal.any([signal, AbortSignal.timeout(12_000)])
		);
		if (result.code !== 0) return undefined;
		const rows = trackerWatchdogAlerts.valueType.array().parse(JSON.parse(result.stdout));
		return rows
			.filter(({ host, item_id }) => host === peer && /^[a-z0-9]{6,10}$/.test(item_id))
			.slice(0, 200);
	} catch {
		signal.throwIfAborted();
		return undefined;
	}
}
