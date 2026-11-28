import { subscriptionInput } from '../push/pushPayload';
import { readAccountChain, requireEnrollmentApprover } from './syncDeviceSession';
import { readSyncJson, syncJson, syncProblem } from './syncHttp';
import type { SyncCall } from './syncPolicy.types';
import type { ApprovalPush, ApprovalPushRow } from './syncApprovalPush.types';

/** A Google session must prove its approved installation before it can listen for approvals. */
export async function approvalPush(call: SyncCall): Promise<Response> {
	const { request, deps } = call;
	const origin = request.headers.get('Origin');
	if (call.url.search || (origin !== null && origin !== call.url.origin))
		return syncProblem(403, 'origin-denied');
	const refusal = await requireEnrollmentApprover(call, true);
	if (refusal) return refusal;
	if (!deps.approvalPush) return syncProblem(404, 'unavailable');
	if (request.method === 'GET') return syncJson({ publicKey: deps.approvalPush.publicKey });
	if (request.method === 'DELETE') {
		await deleteTarget(call);
		return syncJson({ subscribed: false });
	}
	const input = subscriptionInput.safeParse(await readSyncJson(request, 4096));
	if (!input.success) return syncProblem(400, 'invalid-input');
	await saveTarget(call, input.data);
	return syncJson({ subscribed: true });
}

async function saveTarget(call: SyncCall, target: Parameters<ApprovalPush['deliver']>[0]) {
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
	if (!push) return;
	const delivery = deliver(call, push).catch(() => {});
	if (push.schedule) push.schedule(delivery);
	else await delivery;
}

async function deliver(call: SyncCall, push: ApprovalPush) {
	const { db, now } = call.deps;
	const chain = await readAccountChain(db, call.account);
	if (!chain) return;
	const { results } = await db
		.prepare(
			`SELECT p.device, p.session_hash, p.endpoint, p.p256dh, p.auth
			FROM approval_web_push p JOIN auth_sessions s ON s.id_hash = p.session_hash
			WHERE p.account = ? AND p.device != ? AND s.actor_id = p.account
				AND s.sealed_device_id = p.device AND s.revoked_at IS NULL AND s.expires_at > ?`
		)
		.bind(call.account, call.device, now)
		.all<ApprovalPushRow>();
	const active = results.filter(({ device }) => {
		const entry = chain.devices[device];
		return entry?.active && entry.role === 'admin';
	});
	await Promise.allSettled(active.map((target) => deliverTarget(call, push, target)));
}

async function deliverTarget(call: SyncCall, push: ApprovalPush, target: ApprovalPushRow) {
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
