// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { trackerManagedHostLauncher } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerManagedHostLauncher';
import type {
	TrackerHostLaunchConfig,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type { TrackerHostLaunchPort } from './trackerHostLaunch.types';
import { hostInventory, hostStart } from './trackerHostLaunchSchema';

export function trackerHostLaunchPort(
	config: TrackerHostLaunchConfig,
	client?: TrackerWorkerClient
): TrackerHostLaunchPort {
	if ('managed' in config) {
		if (!client)
			throw new TypeError('Tracker managed launcher needs the verified local client address');
		return trackerManagedHostLauncher(config.managed, { client });
	}
	const driver = new TrackerHostProcessAdapter(config.driver);
	return {
		async inspect(input, signal) {
			return hostInventory.parse(await driver.request('inspect', input, signal));
		},
		async start(input, signal) {
			return hostStart.parse(await driver.request('start', input, signal));
		}
	};
}
