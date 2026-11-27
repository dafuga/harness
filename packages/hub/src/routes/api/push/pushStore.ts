import { webPushContract } from '../../../../../../src/utils/projects-sessions/webPushContract';
import type {
	PushQuietHours,
	PushSenderReport,
	PushSubscriptionTarget
} from '../../../../../../src/utils/projects-sessions/webPushContract.types';
import type { PushOwner, StoredSubscription } from './pushStore.types';

/** The address is long and secret-like, so rows and the page name a browser by its hash. */
export async function subscriptionId(endpoint: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Saving again refreshes the keys. Past the limit the oldest browser is dropped. */
export async function saveSubscription(
	{ db, actor }: PushOwner,
	{ endpoint, keys }: PushSubscriptionTarget,
	now: number
) {
	await db
		.prepare(
			`INSERT INTO web_push_subscriptions (actor_id, id, endpoint, p256dh, auth, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (actor_id, id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
		)
		.bind(actor, await subscriptionId(endpoint), endpoint, keys.p256dh, keys.auth, now)
		.run();
	await db
		.prepare(
			`DELETE FROM web_push_subscriptions WHERE actor_id = ?1 AND id NOT IN
			 (SELECT id FROM web_push_subscriptions WHERE actor_id = ?1
			  ORDER BY created_at DESC LIMIT ?2)`
		)
		.bind(actor, webPushContract.maxSubscriptions)
		.run();
}

export async function removeSubscription({ db, actor }: PushOwner, endpoint: string) {
	await db
		.prepare('DELETE FROM web_push_subscriptions WHERE actor_id = ? AND id = ?')
		.bind(actor, await subscriptionId(endpoint))
		.run();
}

export async function listSubscriptions({ db, actor }: PushOwner): Promise<StoredSubscription[]> {
	const { results } = await db
		.prepare(
			`SELECT id, endpoint, p256dh, auth, delivered_at FROM web_push_subscriptions
			 WHERE actor_id = ? ORDER BY created_at`
		)
		.bind(actor)
		.all<StoredSubscription>();
	return results;
}

export async function readQuiet({ db, actor }: PushOwner): Promise<PushQuietHours> {
	const row = await db
		.prepare(
			'SELECT quiet_enabled, quiet_start, quiet_end FROM web_push_settings WHERE actor_id = ?'
		)
		.bind(actor)
		.first<{ quiet_enabled: number; quiet_start: string; quiet_end: string }>();
	return row
		? { enabled: row.quiet_enabled === 1, start: row.quiet_start, end: row.quiet_end }
		: webPushContract.defaultQuietHours;
}

export async function saveQuiet({ db, actor }: PushOwner, { enabled, start, end }: PushQuietHours) {
	await db
		.prepare(
			`INSERT INTO web_push_settings (actor_id, quiet_enabled, quiet_start, quiet_end)
			 VALUES (?, ?, ?, ?) ON CONFLICT (actor_id) DO UPDATE SET
			 quiet_enabled = excluded.quiet_enabled, quiet_start = excluded.quiet_start,
			 quiet_end = excluded.quiet_end`
		)
		.bind(actor, enabled ? 1 : 0, start, end)
		.run();
}

export async function recordDelivery(owner: PushOwner, report: PushSenderReport, now: number) {
	for (const endpoint of report.delivered)
		await owner.db
			.prepare('UPDATE web_push_subscriptions SET delivered_at = ? WHERE actor_id = ? AND id = ?')
			.bind(now, owner.actor, await subscriptionId(endpoint))
			.run();
	for (const endpoint of report.gone) await removeSubscription(owner, endpoint);
}
