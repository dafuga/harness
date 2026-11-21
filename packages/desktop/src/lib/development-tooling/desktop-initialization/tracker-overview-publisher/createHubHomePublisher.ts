// @harness-uid u_s7u2mjlzu4
import type {
	HomeChatInput,
	HomeChatReceipt
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { buildHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '$reports/lib/projects-sessions/project-overview/projectOverviewTracker';
import type { NativeHostedCredential } from '../remote-http-project-adapter/RemoteHttpProjectAdapter';
import type { TrackerOverviewAuthority } from './TrackerOverviewPublisher.types';
import { createHomeProviderReader } from './homeProviderReader';
import { deliverHomeChat } from './homeTrackerChat';

export function createHubHomePublisher(options: { file?: string; codexHistoryFile?: string }) {
	const providers = createHomeProviderReader(options);
	return async (
		authority: TrackerOverviewAuthority,
		credential: NativeHostedCredential,
		current: () => boolean
	) => {
		if (!authority.publishHome || !authority.finishHomeChat || !current()) return;
		const now = Date.now();
		const [readings, sources] = await Promise.all([
			providers(now),
			readTrackerSources(fetch, true).catch(() => null)
		]);
		if (!current()) return;
		const snapshot = buildHomeSnapshot(sources, readings, now);
		const messages = await authority.publishHome(credential, JSON.stringify(snapshot));
		for (const message of messages) {
			if (!current()) return;
			await deliver(authority.finishHomeChat, credential, message, current);
		}
	};
}

async function deliver(
	finish: (credential: NativeHostedCredential, receipt: HomeChatReceipt) => Promise<void>,
	credential: NativeHostedCredential,
	message: HomeChatInput,
	current: () => boolean
) {
	const sources = await readTrackerSources(fetch, true).catch(() => null);
	if (!current()) return;
	const agents = buildHomeSnapshot(sources, { routines: null, quota: null }, Date.now()).agents;
	const receipt = await deliverHomeChat(message, agents);
	await finish(credential, receipt);
}
