import type { SessionRecord } from '../../../models/accounts-access/HubAuthStore.types';
import { readAccountChain, sessionBoundDevice } from './syncDeviceSession';
import { hasRecoverableAccount } from './syncRecovery';
import { syncProblem } from './syncHttp';

const signInRoutes = new Set([
	'GET /api/auth/status',
	'POST /api/auth/challenge',
	'POST /api/auth/google',
	'POST /api/auth/logout',
	'POST /api/auth/email/start',
	'POST /api/auth/email/verify',
	'POST /api/auth/native/start',
	'POST /api/auth/native/poll',
	'POST /api/auth/native/exchange',
	'POST /api/auth/native/return'
]);

export function needsHubDeviceGuard(request: Request): boolean {
	const path = new URL(request.url).pathname;
	return (
		path.startsWith('/api/') &&
		!path.startsWith('/api/sync/v1/') &&
		!signInRoutes.has(request.method + ' ' + path)
	);
}

/** A login cookie or native token for a recoverable account cannot open private Hub APIs alone. */
export async function guardHubDeviceSession(
	request: Request,
	db: D1Database,
	session: SessionRecord | null,
	now: number
): Promise<Response | undefined> {
	if (!session || !needsHubDeviceGuard(request)) return;
	try {
		const account = session.actor.id;
		if (!(await hasRecoverableAccount(db, account))) return;
		const device = await sessionBoundDevice(db, session.idHash, account, now);
		if (!device) return syncProblem(403, 'device-approval-required');
		const chain = await readAccountChain(db, account);
		const admitted = chain?.devices[device];
		if (!admitted?.active || admitted.role !== 'admin')
			return syncProblem(403, 'device-approval-required');
	} catch {
		return syncProblem(503, 'unavailable');
	}
}
