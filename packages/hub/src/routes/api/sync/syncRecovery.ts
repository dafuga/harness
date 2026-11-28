import type { D1Like } from '../[...path]/d1-auth-store-adapter/D1AuthStoreAdapter.types';
import type { SyncCall } from './syncPolicy.types';
import { syncJson, syncProblem } from './syncHttp';

export function recoveryBlob(call: SyncCall) {
	return call.deps.db
		.prepare('SELECT recovery FROM sealed_recoveries WHERE account = ?')
		.bind(call.account)
		.first<string>('recovery');
}

/** Legacy writes that affect zero rows are refused when a newer account uses atomic writes. */
export async function deviceWriteConflict(call: SyncCall, legacyError?: string): Promise<Response> {
	if (await isRecoverableAccount(call)) return syncProblem(409, 'atomic-device-change-required');
	return legacyError ? syncProblem(409, legacyError) : syncJson({ stored: 0 }, 201);
}

export function isRecoverableAccount(call: SyncCall): Promise<boolean> {
	return hasRecoverableAccount(call.deps.db, call.account);
}

export async function hasRecoverableAccount(db: D1Like, account: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 AS present FROM sealed_recoveries WHERE account = ?')
		.bind(account)
		.first<{ present: number }>();
	return row?.present === 1;
}
