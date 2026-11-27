// @harness-uid u_q6kheadco5
import {
	buildHomeSnapshot,
	noProviders
} from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import { homeChatInput } from '$reports/lib/projects-sessions/hub-home/homeChatInput';
import { readTrackerSources } from '$reports/lib/projects-sessions/project-overview/projectOverviewTracker';
import { RemoteFailure } from '../../../../../../remote/src/index';
import { deliverHomeChat } from './homeTrackerChat';

/**
 * What this Mac does when a device of the signed-in account answers from Home over the encrypted
 * connection: the message is checked against the Tracker as it is now, then written as Daniel's.
 */
export function createHomeChatWriter(fetcher?: typeof fetch) {
	return async (input: unknown) => {
		const message = homeChatInput.safeParse(input);
		if (!message.success) throw new RemoteFailure('invalid-message');
		const fetchRequest = fetcher ?? fetch;
		const sources = await readTrackerSources(fetchRequest, true).catch(() => null);
		const home = buildHomeSnapshot(sources, noProviders, Date.now());
		return deliverHomeChat(message.data, home, fetchRequest);
	};
}
