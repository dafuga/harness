// @harness-uid u_s7u2mjlzu4
import type { HomeChatInput } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import {
	buildHomeSnapshot,
	noProviders
} from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '$reports/lib/projects-sessions/project-overview/projectOverviewTracker';
import type { NativeHostedCredential } from '../remote-http-project-adapter/RemoteHttpProjectAdapter';
import { HostedHttpAdapter } from '../../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { QuotaSource } from './codexQuotaSource.types';
import { createHomeProviderReader } from './homeProviderReader';
import { deliverHomeChat } from './homeTrackerChat';
import { readLocalAttachment } from './readLocalAttachment';
import type { HubHomeReply } from './createHubHomePublisher.types';

const homePath = '/api/hub-home';

/** Uses the factory's already verified connection and the transported actor, without changing the desktop startup service. */
export function createHubHomePublisher(file?: string, sources?: QuotaSource[]) {
	const providers = createHomeProviderReader(file, sources);
	return async (credential: NativeHostedCredential, current: () => boolean) => {
		if (!current()) return;
		const now = Date.now();
		const [readings, sources] = await Promise.all([
			providers(now),
			readTrackerSources(fetch, true).catch(() => null)
		]);
		if (!current()) return;
		const http = new HostedHttpAdapter({
			origin: credential.origin,
			credentials: () => Promise.resolve(credential)
		});
		const snapshot = buildHomeSnapshot(sources, readings, now);
		const response = await http.request(homePath, credential, {
			method: 'PUT',
			body: JSON.stringify(snapshot)
		});
		const result = (await response.json()) as HubHomeReply;
		await uploadHomeDocuments(http, credential, result.wantDocs, current);
		const messages = Array.isArray(result.messages) ? result.messages.slice(0, 10) : [];
		for (const message of messages) {
			if (!current()) return;
			await deliver(http, credential, message, current);
		}
	};
}

/** Hub names the ask documents it does not hold. A failed upload is asked for again later. */
async function uploadHomeDocuments(
	http: HostedHttpAdapter,
	credential: NativeHostedCredential,
	wanted: HubHomeReply['wantDocs'],
	current: () => boolean
) {
	for (const entry of Array.isArray(wanted) ? wanted.slice(0, 4) : []) {
		const document = await readLocalAttachment(entry).catch(() => null);
		if (!current()) return;
		if (!document) continue;
		await http
			.request(homePath + '/doc', credential, {
				method: 'PUT',
				body: JSON.stringify({ id: entry.id, document })
			})
			.catch(() => null);
	}
}

async function deliver(
	http: HostedHttpAdapter,
	credential: NativeHostedCredential,
	message: HomeChatInput,
	current: () => boolean
) {
	const sources = await readTrackerSources(fetch, true).catch(() => null);
	if (!current()) return;
	const home = buildHomeSnapshot(sources, noProviders, Date.now());
	const receipt = await deliverHomeChat(message, home);
	if (!current()) return;
	await http.request(homePath + '/chat', credential, {
		method: 'PUT',
		body: JSON.stringify(receipt)
	});
}
