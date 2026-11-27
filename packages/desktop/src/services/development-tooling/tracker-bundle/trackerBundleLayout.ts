// @harness-uid u_tb4lyx3rsa
import { join } from 'node:path';

export const trackerLabel = 'local.harness.tracker';

/** Every path the bundled Tracker touches under one home directory. */
export function trackerBundleLayout(home: string) {
	const state = join(home, '.local/state/tracker');
	return {
		releases: join(state, 'harness-releases'),
		record: join(state, 'tracker-bundle.json'),
		lock: join(state, 'tracker-bundle.lock'),
		launcher: join(home, '.local/libexec/harness/harness'),
		entry: join(home, '.local/bin/tracker'),
		agent: join(home, 'Library/LaunchAgents', `${trackerLabel}.plist`),
		config: join(home, '.config/harness/tracker.json'),
		logs: join(home, '.local/state/harness/tracker-native/logs')
	};
}

/** The executable and shim the app carries inside its bundle. */
export function bundledTrackerFiles(app: string) {
	return {
		executable: join(app, 'Contents/Helpers/harness'),
		shim: join(app, 'Contents/Resources/tracker-shim.sh')
	};
}
