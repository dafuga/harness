import { z } from 'zod';
import { approvalPushTargets } from './syncApprovalTargets';
import { requireEnrollmentApprover, type readAccountChain } from './syncDeviceSession';
import { readSyncJson, syncJson, syncProblem } from './syncHttp';
import type { SyncCall } from './syncPolicy.types';
import type { ApnsApprovalPush, ApprovalApnsRow } from './syncApprovalPush.types';

const registration = z.strictObject({ token: z.string().regex(/^(?:[0-9a-f]{2}){1,256}$/) });

/** Only the admitted app can bind the platform-provided token to its current session. */
export async function approvalApns(call: SyncCall): Promise<Response> {
	if (call.url.search || call.sessionKind !== 'native') return syncProblem(403, 'native-required');
	const refusal = await requireEnrollmentApprover(call, true);
	if (refusal) return refusal;
	const available = Boolean(call.deps.approvalPush?.apns);
	if (call.request.method === 'GET') return syncJson({ available });
	if (!available) return syncProblem(404, 'unavailable');
	const input = registration.safeParse(await readSyncJson(call.request, 1024));
	if (!input.success) return syncProblem(400, 'invalid-input');
	await saveToken(call, input.data.token);
	return syncJson({ subscribed: true });
}

async function saveToken(call: SyncCall, token: string): Promise<void> {
	const {
		account,
		device,
		sessionHash,
		deps: { db }
	} = call;
	await db.batch([
		db
			.prepare('DELETE FROM approval_apns WHERE token = ? AND (account != ? OR device != ?)')
			.bind(token, account, device),
		db
			.prepare(
				`INSERT INTO approval_apns (account, device, session_hash, token) VALUES (?, ?, ?, ?)
				 ON CONFLICT (account, device) DO UPDATE SET session_hash = excluded.session_hash,
				   token = excluded.token`
			)
			.bind(account, device, sessionHash, token)
	]);
}

export async function deliverApnsTargets(
	call: SyncCall,
	chain: NonNullable<Awaited<ReturnType<typeof readAccountChain>>>,
	push: ApnsApprovalPush
): Promise<void> {
	const rows = await approvalPushTargets<ApprovalApnsRow>(call, chain, 'approval_apns');
	await Promise.allSettled(
		rows.map(async (row) => {
			if ((await push.deliver(row.token)) !== 'gone') return;
			await call.deps.db
				.prepare(
					'DELETE FROM approval_apns WHERE account = ? AND device = ? AND session_hash = ? AND token = ?'
				)
				.bind(call.account, row.device, row.session_hash, row.token)
				.run();
		})
	);
}
