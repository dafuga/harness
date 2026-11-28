import { subscriptionInput } from '../push/pushPayload';
import { readAccountChain, requireEnrollmentApprover } from './syncDeviceSession';
import { readSyncJson, syncJson, syncProblem } from './syncHttp';
import type { SyncCall } from './syncPolicy.types';
import type { ApprovalPush, ApprovalPushRow, WebApprovalPush } from './syncApprovalPush.types';
import { approvalPushTargets } from './syncApprovalTargets';
import { deliverApnsTargets } from './syncApprovalApns';

/** A Google session must prove its approved installation before it can listen for approvals. */
export async function approvalPush(call: SyncCall): Promise<Response> {
	const { request, deps } = call;
	const origin = request.headers.get('Origin');
	if (call.url.search || (origin !== null && origin !== call.url.origin))
		return syncProblem(403, 'origin-denied');
	const refusal = await requireEnrollmentApprover(call, true);
	if (refusal) return refusal;
	const push = deps.approvalPush?.web;
	if (request.method === 'GET') return syncJson({ publicKey: push?.publicKey ?? null });
	if (!push) return syncProblem(404, 'unavailable');
	if (request.method === 'DELETE') {
		await deleteTarget(call);
		return syncJson({ subscribed: false });
	}
	const input = subscriptionInput.safeParse(await readSyncJson(request, 4096));
	if (!input.success) return syncProblem(400, 'invalid-input');
	await saveTarget(call, input.data);
	return syncJson({ subscribed: true });
}

async function saveTarget(call: SyncCall, target: Parameters<WebApprovalPush['deliver']>[0]) {
	const {
		account,
		device,
		sessionHash,
		deps: { db }
	} = call;
	const { endpoint, keys } = target;
	await db.batch([
		db
			.prepare(`DELETE FROM approval_web_push WHERE endpoint = ? AND (account != ? OR device != ?)`)
			.bind(endpoint, account, device),
		db
			.prepare(
				`INSERT INTO approval_web_push (account, device, session_hash, endpoint, p256dh, auth)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT (account, device) DO UPDATE SET
				session_hash = excluded.session_hash, endpoint = excluded.endpoint,
				p256dh = excluded.p256dh, auth = excluded.auth`
			)
			.bind(account, device, sessionHash, endpoint, keys.p256dh, keys.auth)
	]);
}

async function deleteTarget(call: SyncCall) {
	await call.deps.db
		.prepare('DELETE FROM approval_web_push WHERE account = ? AND device = ? AND session_hash = ?')
		.bind(call.account, call.device, call.sessionHash)
		.run();
}

/** Fan out only the generic notice, independently of the enrollment response. */
export async function notifyApprovalDevices(call: SyncCall): Promise<void> {
	const push = call.deps.approvalPush;
	if (!push || (!push.web && !push.apns)) return;
	const delivery = deliver(call, push).catch(() => {});
	if (push.schedule) push.schedule(delivery);
	else await delivery;
}

async function deliver(call: SyncCall, push: ApprovalPush) {
	const chain = await readAccountChain(call.deps.db, call.account);
	if (!chain) return;
	await Promise.allSettled([
		push.web && deliverWebTargets(call, chain, push.web),
		push.apns && deliverApnsTargets(call, chain, push.apns)
	]);
}

async function deliverWebTargets(
	call: SyncCall,
	chain: NonNullable<Awaited<ReturnType<typeof readAccountChain>>>,
	push: WebApprovalPush
) {
	const active = await approvalPushTargets<ApprovalPushRow>(call, chain, 'approval_web_push');
	await Promise.allSettled(active.map((target) => deliverTarget(call, push, target)));
}

async function deliverTarget(call: SyncCall, push: WebApprovalPush, target: ApprovalPushRow) {
	const { endpoint, p256dh, auth } = target;
	if ((await push.deliver({ endpoint, keys: { p256dh, auth } })) !== 'gone') return;
	await call.deps.db
		.prepare(
			`DELETE FROM approval_web_push
			WHERE account = ? AND device = ? AND session_hash = ? AND endpoint = ?`
		)
		.bind(call.account, target.device, target.session_hash, endpoint)
		.run();
}
