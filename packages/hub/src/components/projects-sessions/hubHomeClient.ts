// @harness-uid u_kqbmr6buaf
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeOutgoingPath } from '$reports/components/projects-sessions/hub-home/hubHomeOutgoingDraft';
import type { HomeOutgoingSource } from '$reports/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';
import type { BrowserApi } from '../../utils/browserApi';
import type { ReadHomeResult } from '$reports/components/projects-sessions/hub-home/hubHomeView.types';

/** The owner projection uses a successful response with a neutral body when unavailable. */
export async function readHome(api: BrowserApi): Promise<ReadHomeResult> {
	try {
		return await api.get<ReadHomeResult>('/api/hub-home');
	} catch {
		return { granted: false, snapshot: null };
	}
}

export function homeSnapshot(result: ReadHomeResult | null): OwnerHomeSnapshot | null {
	return result?.granted ? result.snapshot : null;
}

/** Reads and approves drafts with the Hub browser session. */
export function homeOutgoing(api: BrowserApi): HomeOutgoingSource {
	return {
		read: () => api.get(homeOutgoingPath),
		write: (action) => api.send('POST', homeOutgoingPath, action)
	};
}
