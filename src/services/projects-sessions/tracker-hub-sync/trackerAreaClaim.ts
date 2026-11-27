// @harness-uid u_jkomno4o5u
import type { TrackerAreaClaim, Owner, AreaDecision } from './trackerAreaClaim.types';
import { z } from 'zod';
import { TrackerHubInputError } from './TrackerHubInputError';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const path = z
	.string()
	.min(1)
	.max(1024)
	.refine(
		(area) =>
			area === '.' ||
			(area.split('/').every((part) => part && part !== '.' && part !== '..') &&
				!/[\\\p{Cc}]/u.test(area))
	);
export const areaClaim = z.strictObject({
	id: z.string().min(1).max(80),
	token: z.string().min(1).max(256),
	attempt: z.int().positive().default(1),
	repo: z
		.string()
		.regex(/^[\w.-]+\/[\w.-]+$/)
		.max(200),
	probe: z.boolean().optional(),
	project: z.string().min(1).max(200).optional(),
	areas: z.array(path).min(1).max(512)
});
const schema = `
CREATE TABLE IF NOT EXISTS tracker_area_claims (
	id TEXT PRIMARY KEY, token TEXT NOT NULL, node TEXT NOT NULL, repo TEXT NOT NULL, areas TEXT NOT NULL, attempt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tracker_area_repo ON tracker_area_claims(repo);
CREATE TRIGGER IF NOT EXISTS tracker_area_closed AFTER UPDATE ON items
WHEN (OLD.status != NEW.status AND NEW.status IN ('blocked','done','ignored')) OR NEW.deleted = 1
BEGIN DELETE FROM tracker_area_claims WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS tracker_area_stopped AFTER INSERT ON ops
WHEN json_type(NEW.fields,'$.area_release') = 'text'
BEGIN DELETE FROM tracker_area_claims WHERE id = NEW.item_id AND node = NEW.node
AND token = json_extract(NEW.fields,'$.area_release') AND attempt = json_extract(NEW.fields,'$.area_attempt'); END;
CREATE TRIGGER IF NOT EXISTS tracker_area_idle_stop AFTER INSERT ON ops
WHEN json_type(NEW.fields,'$.area_stop_idle')='text'
BEGIN DELETE FROM tracker_area_claims WHERE id=NEW.item_id AND node=NEW.node
AND (token GLOB 'manual:*' OR token=json_extract(NEW.fields,'$.area_stop_idle')); END;`;

/** A directory covers its descendants. Case aliases on Mac must also conflict. */
export function areaIntersects(left: string, right: string): boolean {
	const a = left.normalize('NFC').toLowerCase();
	const b = right.normalize('NFC').toLowerCase();
	return a === '.' || b === '.' || a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

export function trackerAreaAuthority(store: TrackerPersistenceService) {
	store.database.exec(schema);
	return (input: unknown, node: string): AreaDecision => {
		const parsed = areaClaim.safeParse(input);
		if (!parsed.success || !/^[\w.-]{1,80}$/.test(node))
			throw new TrackerHubInputError(400, 'invalid Tracker area claim');
		const req = { ...parsed.data, repo: parsed.data.repo.toLowerCase() };
		return store.commitLocal<AreaDecision>(() => acquireAreas(store, req, node));
	};
}

const eligibleItem = `SELECT 1 FROM items WHERE id=? AND deleted=0
 AND (auto=? OR (auto IS NULL AND ? GLOB 'manual:*'))
 AND (status IN ('open','in_progress') OR
 (status='blocked' AND resolved=1 AND needs_daniel=0
 AND json_extract(clocks,'$.answer') > json_extract(clocks,'$.status')))`;

function acquireAreas(store: TrackerPersistenceService, req: TrackerAreaClaim, node: string) {
	const item = store.database.prepare(eligibleItem).get(req.id, req.token, req.token);
	if (!item) return denied('waiting for the current launch on the Tracker hub');
	const legacy = legacyOwner(store, req);
	if (legacy) return denied('waiting for existing run ' + legacy.id + ' to claim its areas');
	const owners = store.database
		.prepare('SELECT * FROM tracker_area_claims WHERE repo = ? OR id = ? ORDER BY rowid')
		.all(req.repo, req.id) as Owner[];
	const existing = owners.find(({ id }) => id === req.id);
	if (existing && !sameOwner(existing, req, node))
		return denied('previous run still owns the item claim on ' + existing.node);
	return reservePaths(store, { req, node }, owners, existing);
}

function reservePaths(
	store: TrackerPersistenceService,
	{ req, node }: { req: TrackerAreaClaim; node: string },
	owners: Owner[],
	existing?: Owner
) {
	const areas: string[] = [
		...new Set<string>([...req.areas, ...JSON.parse(existing?.areas ?? '[]')])
	].sort();
	const blockers = owners.filter(
		(owner) =>
			owner.id !== req.id &&
			(JSON.parse(owner.areas) as string[]).some((path) =>
				areas.some((area) => areaIntersects(path, area))
			)
	);
	if (blockers.length)
		return {
			result: {
				allowed: false,
				reason: 'waiting for ' + blockers.map((b) => b.id + ' on ' + b.node).join(', ')
			}
		};
	if (req.probe) return { result: { allowed: true, reason: 'No overlapping Tracker claims' } };
	const json = JSON.stringify(areas);
	const reason = `Area claim on ${req.repo} by ${req.id} (${node}): ${areas.join(', ')}`;
	const result = { allowed: true, reason };
	if (json === existing?.areas) return { result };
	store.database
		.prepare(
			'INSERT INTO tracker_area_claims VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET areas = excluded.areas'
		)
		.run(req.id, req.token, node, req.repo, json, req.attempt);
	return {
		result,
		operation: {
			itemId: req.id,
			fields: {
				'note+': reason,
				area_claim: { label: reason, token: req.token, node, attempt: req.attempt }
			}
		}
	};
}

function sameOwner(existing: Owner, req: TrackerAreaClaim, node: string) {
	return (
		existing.node === node &&
		existing.token === req.token &&
		existing.attempt === req.attempt &&
		existing.repo === req.repo
	);
}

// Before upgrading, running sessions may own edits without a claim. Let those sessions declare
// their areas first, then compare their actual paths for all subsequent starts.
function legacyOwner(store: TrackerPersistenceService, req: TrackerAreaClaim) {
	if (!req.project) return undefined;
	const live = `WITH live AS (
	  SELECT item_id,project FROM runs WHERE state IN ('queued','running','observed','verifying')
	  UNION ALL SELECT item_id,project FROM remote_runs WHERE state IN ('queued','running','observed','verifying')
	) SELECT DISTINCT i.id FROM live r JOIN items i ON i.id=r.item_id
	WHERE lower(coalesce(r.project,i.project,i.agent,''))=lower(?)
	AND i.status IN ('open','in_progress') AND i.deleted=0
	AND NOT EXISTS (SELECT 1 FROM tracker_area_claims c WHERE c.id=i.id)`;
	const owners = store.database.prepare(live).all(req.project) as { id: string }[];
	return owners.some(({ id }) => id === req.id) ? undefined : owners[0];
}

function denied(reason: string) {
	return { result: { allowed: false, reason } };
}
