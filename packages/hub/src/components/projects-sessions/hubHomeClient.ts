// @harness-uid u_kqbmr6buaf
import type { OwnerHomeSnapshot } from '../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type { BrowserApi } from '../../utils/browserApi';
import type { ReadHomeResult } from './hubHomeView.types';

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
