// @harness-uid u_q6kheadco5
import {
	buildHomeSnapshot,
	noProviders
} from '../../../../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { homeChatInput } from '../../../../../../reports/src/lib/projects-sessions/hub-home/homeChatInput';
import { readTrackerSources } from '../../../../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { RemoteFailure } from '../../../../../../remote/src/index';
import { deliverHomeChat } from './homeTrackerChat';

/**
 * What this Mac does when a device of the signed-in account answers from Home over the encrypted
 * connection: the message is checked against the Tracker as it is now, then written as Daniel's.
 */
export function createHomeChatWriter(fetcher: typeof fetch = fetch) {
	return async (input: unknown) => {
		const message = homeChatInput.safeParse(input);
		if (!message.success) throw new RemoteFailure('invalid-message');
		const sources = await readTrackerSources(fetcher, true).catch(() => null);
		const home = buildHomeSnapshot(sources, noProviders, Date.now());
		return deliverHomeChat(message.data, home, fetcher);
	};
}
