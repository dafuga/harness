// @harness-uid u_bl6xl2h4a3
import { TrackerGmailAdapter } from '../../../adapters/projects-sessions/TrackerGmailAdapter';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import type { TrackerHostAdapterConfig } from './nativeTrackerHostEffects.types';

/** The configured Vault runner hands a short-lived token directly to the trusted Gmail transport. */
export function trackerGmailHost(config: NonNullable<TrackerHostAdapterConfig['gmail']>) {
	const { account } = config;
	const executable = controlledTrackerExecutable(config.tokenDriver);
	const adapter = new TrackerGmailAdapter({
		account,
		async readAccessToken(signal) {
			const result = await runTrackerHostCommand(executable, [], signal);
			if (result.code !== 0) throw new Error('Gmail credential unavailable');
			return result.stdout.trim();
		}
	});
	return adapter.read.bind(adapter);
}
