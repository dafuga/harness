import type { SyncCall } from './syncPolicy.types';
import type { ApprovalDeviceRow, ApprovalPushTable } from './syncApprovalPush.types';
import type { readAccountChain } from './syncDeviceSession';

/** Match the verified ledger to the current head while selecting unrevoked sessions. */
export async function approvalPushTargets<Row extends ApprovalDeviceRow>(
	call: SyncCall,
	chain: NonNullable<Awaited<ReturnType<typeof readAccountChain>>>,
	table: ApprovalPushTable
): Promise<Row[]> {
	const { db, now } = call.deps;
	const { results } = await db
		.prepare(
			`SELECT p.* FROM ${table} p JOIN auth_sessions s ON s.id_hash = p.session_hash
			 WHERE p.account = ? AND p.device != ? AND s.actor_id = p.account
			   AND s.sealed_device_id = p.device AND s.revoked_at IS NULL AND s.expires_at > ?
			   AND ? = (SELECT hash FROM sealed_chain WHERE account = p.account ORDER BY seq DESC LIMIT 1)`
		)
		.bind(call.account, call.device, now, chain.head)
		.all<Row>();
	return results.filter(({ device }) => {
		const entry = chain.devices[device];
		return entry?.active && entry.role === 'admin';
	});
}
