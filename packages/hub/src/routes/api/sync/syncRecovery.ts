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

export async function isRecoverableAccount(call: SyncCall): Promise<boolean> {
	const present = await call.deps.db
		.prepare('SELECT 1 AS present FROM sealed_recoveries WHERE account = ?')
		.bind(call.account)
		.first<number>('present');
	return present === 1;
}
