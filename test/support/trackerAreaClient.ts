import type { TrackerHubSyncService } from '../../src/services/projects-sessions/TrackerHubSyncService';
import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';
import { wire, fixtureSecret } from './trackerDispatchQueueFixture';
export function claimFrom(hub: TrackerHubSyncService) {
	return async (node: string, id: string, areas: string[]) => {
		const request = {
			method: 'POST' as const,
			pathAndQuery: '/sync/area-claim',
			body: JSON.stringify({ id, token: id, repo: 'fixture/project', areas })
		};
		return wire(hub)({
			...request,
			timeoutMs: 1000,
			headers: {
				authorization: new TrackerSyncAuthService(fixtureSecret).authorizationHeader(request),
				'x-tracker-node': node
			}
		}) as Promise<{ allowed: boolean; reason: string }>;
	};
}
