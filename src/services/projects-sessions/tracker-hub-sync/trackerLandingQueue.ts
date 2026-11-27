// @harness-uid u_jkomno4o5u
import { z } from 'zod';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerHubInputError } from './TrackerHubInputError';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const landingRequest = z.strictObject({
	action: z.enum(['wait', 'renew', 'authorize', 'release', 'inspect']),
	ticket: z.uuid(),
	id: z.string().regex(/^[a-z0-9-]{1,80}$/i),
	repo: z
		.string()
		.regex(/^[\w.-]+\/[\w.-]+$/)
		.max(200),
	pr: z.int().positive(),
	base: sha.optional(),
	head: sha.optional()
});
export type LandingRequest = z.infer<typeof landingRequest>;
export interface LandingDecision {
	allowed: boolean;
	reason: string;
	pinned?: { ticket: string; base: string; head: string };
}
interface Entry {
	ticket: string;
	id: string;
	node: string;
	repo: string;
	pr: number;
	phase: string;
	base: string | null;
	head: string | null;
}

const schema = `CREATE TABLE IF NOT EXISTS tracker_landing_queue (
position INTEGER PRIMARY KEY AUTOINCREMENT, ticket TEXT NOT NULL UNIQUE, id TEXT NOT NULL,
node TEXT NOT NULL, repo TEXT NOT NULL, pr INTEGER NOT NULL, phase TEXT NOT NULL,
touched INTEGER NOT NULL, base TEXT, head TEXT);
CREATE INDEX IF NOT EXISTS tracker_landing_repo ON tracker_landing_queue(repo,position);`;
const ticketLifetime = 120_000;

/** Expire waiting/checking callers. A merge in flight retains its slot across restarts and outages. */
export function trackerLandingAuthority(
	store: TrackerPersistenceService,
	now: () => number = Date.now
) {
	store.database.exec(schema);
	return (input: unknown, node: string): LandingDecision => {
		const parsed = landingRequest.safeParse(input);
		if (!parsed.success || !/^[\w.-]{1,80}$/.test(node))
			throw new TrackerHubInputError(400, 'invalid Tracker landing request');
		const req = { ...parsed.data, repo: parsed.data.repo.toLowerCase() };
		return store.commitLocal<LandingDecision>(() => advance(store.database, req, node, now()));
	};
}
function advance(
	db: TrackerPersistenceService['database'],
	req: LandingRequest,
	node: string,
	time: number
) {
	db.prepare("DELETE FROM tracker_landing_queue WHERE phase != 'merging' AND touched < ?").run(
		time - ticketLifetime
	);
	if (req.action === 'inspect') {
		const pinned = db
			.prepare(
				"SELECT ticket,base,head FROM tracker_landing_queue WHERE phase='merging' AND repo=? AND pr=? AND node=? AND id=?"
			)
			.get(req.repo, req.pr, node, req.id) as LandingDecision['pinned'];
		return {
			result: {
				allowed: Boolean(pinned),
				reason: pinned
					? 'Merge awaiting reconciliation'
					: 'No pending merge for this item on this computer',
				pinned
			}
		};
	}
	const entry = db
		.prepare('SELECT * FROM tracker_landing_queue WHERE ticket = ?')
		.get(req.ticket) as Entry | undefined;
	if (entry && !ownsTicket(entry, req, node))
		return verdict(false, 'landing ticket belongs to another request');
	if (req.action === 'release') {
		db.prepare('DELETE FROM tracker_landing_queue WHERE ticket = ?').run(req.ticket);
		return verdict(true, 'landing slot released');
	}
	if (!entry && req.action !== 'wait') return verdict(false, 'landing ticket expired');
	if (!db.prepare('SELECT 1 FROM items WHERE id = ? AND deleted = 0').get(req.id))
		return verdict(false, 'waiting for the item on the Tracker hub');
	if (!entry)
		db.prepare(
			"INSERT INTO tracker_landing_queue(ticket,id,node,repo,pr,phase,touched) VALUES(?,?,?,?,?,'waiting',?)"
		).run(req.ticket, req.id, node, req.repo, req.pr, time);
	db.prepare('UPDATE tracker_landing_queue SET touched = ? WHERE ticket = ?').run(time, req.ticket);
	return grantFirst(db, req, node);
}
function grantFirst(db: TrackerPersistenceService['database'], req: LandingRequest, node: string) {
	const first = db
		.prepare('SELECT * FROM tracker_landing_queue WHERE repo = ? ORDER BY position LIMIT 1')
		.get(req.repo) as Entry;
	if (first.ticket !== req.ticket)
		return verdict(false, `queued behind ${first.repo}#${first.pr} (${first.id}, ${first.node})`);
	if (req.action === 'wait' || req.action === 'renew')
		return verdict(
			first.phase !== 'merging',
			first.phase === 'merging' ? 'merge already authorized' : 'first in repository queue'
		);
	if (!req.base || !req.head || first.phase === 'merging')
		return verdict(false, 'merge authorization requires a fresh checked base and head');
	db.prepare("UPDATE tracker_landing_queue SET phase='merging', base=?, head=? WHERE ticket=?").run(
		req.base,
		req.head,
		req.ticket
	);
	const result = { allowed: true, reason: 'exact landing candidate authorized' };
	return {
		result,
		operation: {
			itemId: req.id,
			fields: {
				'note+': `Landing ${req.repo}#${req.pr} on ${req.base} at checked head ${req.head} (${node})`
			}
		}
	};
}
function verdict(allowed: boolean, reason: string) {
	return { result: { allowed, reason } };
}

function ownsTicket(entry: Entry, req: LandingRequest, node: string) {
	return (
		entry.id === req.id && entry.pr === req.pr && entry.repo === req.repo && entry.node === node
	);
}
