import type {
	HomeChatInput,
	HomeChatReceipt,
	HomeChatStatus
} from '../../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

const expiry = 2 * 60 * 1000;
const retain = 24 * 60 * 60 * 1000;

export async function queueChat(
	db: D1Database,
	actor: string,
	message: HomeChatInput,
	now: number
) {
	await db
		.prepare(
			`INSERT OR IGNORE INTO hub_home_chat (actor_id, id, payload, created_at, status)
			SELECT ?, ?, ?, ?, 'queued' WHERE (
				SELECT count(*) FROM hub_home_chat WHERE actor_id = ? AND status = 'queued' AND created_at > ?
			) < 100`
		)
		.bind(actor, message.id, JSON.stringify(message), now, actor, now - expiry)
		.run();
	return await chatReceipt(db, actor, message.id, now);
}

export async function chatReceipt(
	db: D1Database,
	actor: string,
	id: string,
	now: number
): Promise<HomeChatReceipt | null> {
	const row = await db
		.prepare(
			`SELECT status, created_at, claimed_at
		FROM hub_home_chat WHERE actor_id = ? AND id = ?`
		)
		.bind(actor, id)
		.first<{ status: HomeChatStatus; created_at: number; claimed_at: number | null }>();
	if (!row || row.created_at <= now - retain) return null;
	if (row.status === 'queued' && row.created_at <= now - expiry)
		return { id, status: row.claimed_at === null ? 'refused' : 'unconfirmed' };
	return { id, status: row.status };
}

/** Each row is claimed once. An ambiguous local reply is never replayed as a second write. */
export async function claimChat(
	db: D1Database,
	actor: string,
	now: number
): Promise<HomeChatInput[]> {
	await db
		.prepare('DELETE FROM hub_home_chat WHERE actor_id = ? AND created_at <= ?')
		.bind(actor, now - retain)
		.run();
	const result = await db
		.prepare(
			`UPDATE hub_home_chat SET claimed_at = ? WHERE actor_id = ? AND id IN (
		SELECT id FROM hub_home_chat WHERE actor_id = ? AND status = 'queued' AND created_at > ?
			AND claimed_at IS NULL ORDER BY created_at, id LIMIT 10
	) AND claimed_at IS NULL RETURNING payload, created_at, id`
		)
		.bind(now, actor, actor, now - expiry)
		.all<{ payload: string; created_at: number; id: string }>();
	return result.results
		.sort((left, right) => left.created_at - right.created_at || left.id.localeCompare(right.id))
		.map((row) => JSON.parse(row.payload) as HomeChatInput);
}

export async function finishChat(db: D1Database, actor: string, receipt: HomeChatReceipt) {
	await db
		.prepare(
			`UPDATE hub_home_chat SET status = ?, payload = '' WHERE actor_id = ? AND id = ?
		AND status = 'queued' AND claimed_at IS NOT NULL`
		)
		.bind(receipt.status, actor, receipt.id)
		.run();
}
