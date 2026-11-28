// @harness-uid u_jkomno4o5u
import type {
	TrackerAreaClaim,
	Owner,
	AreaDecision,
	AreaReservation
} from './trackerAreaClaim.types';
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
	project: z.string().min(1).max(200).optional(),
	/** Declared by an Areas line or `tracker claim`; only these hold other sessions. */
	areas: z.array(path).max(512),
	/** Guessed from mentioned names. Compared for warnings and never stored. */
	inferred: z.array(path).max(512).optional()
});
export const areaDecision = z.object({
	allowed: z.boolean(),
	reason: z.string(),
	recorded: z.boolean(),
	warnings: z.array(z.string())
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

/** The one hold: declared paths that another session has also declared. Other doubts only warn. */
function acquireAreas(store: TrackerPersistenceService, req: TrackerAreaClaim, node: string) {
	const owners = store.database
		.prepare('SELECT * FROM tracker_area_claims WHERE repo = ? OR id = ? ORDER BY rowid')
		.all(req.repo, req.id) as Owner[];
	const existing = owners.find(({ id }) => id === req.id);
	const own = existing && sameOwner(existing, req, node) ? existing : undefined;
	const areas: string[] = [
		...new Set<string>([...req.areas, ...JSON.parse(own?.areas ?? '[]')])
	].sort();
	const rivals = owners.filter((owner) => owner !== own && owner.repo === req.repo);
	const holders = overlapping(rivals, areas);
	if (holders.length)
		return decided(false, `waiting for ${named(holders)}, which declared the same area`);
	const others = rivals.filter(({ id }) => id !== req.id);
	const warnings = overlapWarnings(store, req, others);
	if (!areas.length) return decided(true, 'No declared areas to claim', warnings);
	const unrecorded = unrecordedBecause(store, req, own ? undefined : existing);
	if (unrecorded)
		return decided(true, 'No declared-area clash; areas were not recorded', [
			...warnings,
			unrecorded
		]);
	return reserveAreas(store, { req, node, areas, own }, warnings);
}

function reserveAreas(
	store: TrackerPersistenceService,
	{ req, node, areas, own }: AreaReservation,
	warnings: string[]
) {
	const json = JSON.stringify(areas);
	const reason = `Area claim on ${req.repo} by ${req.id} (${node}): ${areas.join(', ')}`;
	const result: AreaDecision = { allowed: true, reason, recorded: true, warnings };
	if (json === own?.areas) return { result };
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

function overlapping(owners: Owner[], areas: string[]) {
	return owners.filter((owner) =>
		(JSON.parse(owner.areas) as string[]).some((held) =>
			areas.some((area) => areaIntersects(held, area))
		)
	);
}

function named(owners: Owner[]) {
	return owners.map(({ id, node }) => id + ' on ' + node).join(', ');
}

function overlapWarnings(store: TrackerPersistenceService, req: TrackerAreaClaim, others: Owner[]) {
	const near = overlapping(others, req.inferred ?? []);
	const silent = undeclaredRuns(store, req);
	const warnings: string[] = [];
	if (near.length)
		warnings.push(
			'Possible overlap: paths mentioned here fall in areas declared by ' + named(near)
		);
	if (silent.length)
		warnings.push(
			'Live runs on this project declared no areas: ' +
				listed(silent) +
				'. Overlap with them cannot be checked'
		);
	return warnings;
}

function listed(ids: string[]) {
	return ids.slice(0, 5).join(', ') + (ids.length > 5 ? ` and ${ids.length - 5} more` : '');
}

// A live run without a claim declared nothing, so its edits cannot be compared.
function undeclaredRuns(store: TrackerPersistenceService, req: TrackerAreaClaim) {
	if (!req.project) return [];
	const live = `WITH live AS (
	  SELECT item_id,project FROM runs WHERE state IN ('queued','running','observed','verifying')
	  UNION ALL SELECT item_id,project FROM remote_runs WHERE state IN ('queued','running','observed','verifying')
	) SELECT DISTINCT i.id FROM live r JOIN items i ON i.id=r.item_id
	WHERE lower(coalesce(r.project,i.project,i.agent,''))=lower(?) AND i.id != ?
	AND i.status IN ('open','in_progress') AND i.deleted=0
	AND NOT EXISTS (SELECT 1 FROM tracker_area_claims c WHERE c.id=i.id)`;
	const rows = store.database.prepare(live).all(req.project, req.id) as { id: string }[];
	return rows.map(({ id }) => id);
}

/** A claim is stored only for the launch the hub shows, so its release triggers can fire. */
function unrecordedBecause(
	store: TrackerPersistenceService,
	req: TrackerAreaClaim,
	earlier?: Owner
) {
	if (earlier) return `An earlier session of this item on ${earlier.node} still holds its claim`;
	if (!store.database.prepare(eligibleItem).get(req.id, req.token, req.token))
		return 'The Tracker hub does not show this as the current launch of the item';
	return undefined;
}

function decided(allowed: boolean, reason: string, warnings: string[] = []) {
	const result: AreaDecision = { allowed, reason, recorded: false, warnings };
	return { result };
}
