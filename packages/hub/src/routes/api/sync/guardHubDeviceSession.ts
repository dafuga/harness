import type { SessionRecord } from '../../../models/accounts-access/HubAuthStore.types';

export async function guardHubDeviceSession(
	_request: Request,
	_db: D1Database,
	_session: SessionRecord | null,
	_now: number
): Promise<Response | undefined> {
	return undefined;
}
