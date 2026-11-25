// @harness-uid u_xba7ieg4je
import {
	classifyTrackerBlocker,
	escalatesToDaniel,
	trackerBlockerRoute
} from '../../../utils/projects-sessions/classifyTrackerBlocker';
import {
	trackerBlockerLabels,
	trackerBlockerTypes
} from '../../../utils/projects-sessions/trackerBlockerTypes';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type {
	TrackerBlocker,
	TrackerBlockerGroup,
	TrackerBlockerInbox,
	TrackerItemRow
} from '../TrackerItemReadRepository.types';

export const trackerBlockerStaleMinutes = 24 * 60;

/** Type, route, age and dedupe every blocked item and Daniel ask into one inbox. */
export function buildTrackerBlockers(
	rows: readonly TrackerItemRow[],
	nowMs: number,
	statuses: ReadonlyMap<string, string>
): TrackerBlockerInbox {
	return groupTrackerBlockers(trackerBlockerEntries(rows, nowMs, statuses), nowMs);
}

/** One typed entry per item, before deduplication. */
export function trackerBlockerEntries(
	rows: readonly TrackerItemRow[],
	nowMs: number,
	statuses: ReadonlyMap<string, string>
): TrackerBlocker[] {
	return rows.map((row) => toBlocker(row, nowMs, statuses));
}

/** Merge entries that name the same blocker, then group them by type, oldest first. */
export function groupTrackerBlockers(
	entries: readonly TrackerBlocker[],
	nowMs: number
): TrackerBlockerInbox {
	const merged = new Map<string, TrackerBlocker>();
	for (const blocker of entries) {
		const key =
			blocker.kind === 'note'
				? `note|${blocker.id}`
				: `${blocker.type}|${blocker.agent ?? ''}|${normalize(blocker.action)}`;
		const first = merged.get(key);
		if (!first) merged.set(key, blocker);
		else merged.set(key, mergeDuplicate(first, blocker));
	}
	const blockers = [...merged.values()].sort((a, b) => b.age_minutes - a.age_minutes);
	const groups: TrackerBlockerGroup[] = trackerBlockerTypes
		.map((type) => ({
			type,
			label: trackerBlockerLabels[type],
			items: blockers.filter((blocker) => blocker.type === type)
		}))
		.filter((group) => group.items.length);
	return {
		generated_at: new Date(nowMs).toISOString(),
		total: blockers.length,
		unescalated: blockers.filter((blocker) => blocker.needs_escalation).length,
		stale: blockers.filter((blocker) => blocker.stale).length,
		groups
	};
}

function toBlocker(
	row: TrackerItemRow,
	nowMs: number,
	statuses: ReadonlyMap<string, string>
): TrackerBlocker {
	const blocked = row.status === 'blocked';
	const asking = Boolean(row.needs_daniel) && !row.resolved;
	const kind = blockerKind(blocked, asking);
	const action = blockerAction(row, kind);
	const { type, waitsOn } = classifyTrackerBlocker(action, kind === 'flag' ? 'flag' : 'block');
	const at = blockerStart(row, kind, nowMs);
	const age = Math.max(0, Math.floor((nowMs - at) / 60_000));
	const dependencyStatus = waitsOn ? (statuses.get(waitsOn) ?? null) : null;
	const route = trackerBlockerRoute(type);
	return {
		id: row.id,
		title: row.title ?? '',
		kind,
		type,
		label: trackerBlockerLabels[type],
		route,
		route_to: routeTarget(route, row),
		owner: row.owner,
		agent: row.agent,
		parent: row.parent,
		action,
		since: new Date(at).toISOString(),
		age_minutes: age,
		escalated: asking,
		needs_escalation: needsEscalation({ row, asking, type, at }),
		stale: age >= trackerBlockerStaleMinutes,
		chased_at: chasedAt(row),
		waits_on: waitsOn,
		dependency_status: dependencyStatus,
		recheck: recheckReason(age, dependencyStatus, waitsOn),
		duplicates: []
	};
}

function blockerAction(row: TrackerItemRow, kind: TrackerBlocker['kind']): string {
	if (kind === 'note') return (row.blocker_note ?? '').trim();
	const candidates = [kind === 'flag' ? row.question : row.blocked_reason, row.question, row.title];
	return (candidates.find((text) => text) ?? '').trim();
}

/** A Daniel-typed block not on Needs Daniel, unless someone already answered it since. */
function needsEscalation(input: {
	row: TrackerItemRow;
	asking: boolean;
	type: TrackerBlocker['type'];
	at: number;
}): boolean {
	const { row, asking, type, at } = input;
	if (asking || !escalatesToDaniel(type)) return false;
	return !(Date.parse(row.answered_at ?? '') > at);
}

function blockerKind(blocked: boolean, asking: boolean): TrackerBlocker['kind'] {
	if (!blocked) return asking ? 'flag' : 'note';
	return asking ? 'block+flag' : 'block';
}

/** When the blocker was reported, from its note or field clock. */
function blockerStart(row: TrackerItemRow, kind: TrackerBlocker['kind'], nowMs: number): number {
	const clocks = JSON.parse(row.clocks) as Record<string, string | undefined>;
	const clock =
		kind === 'note' ? (row.blocker_note_clock ?? clocks.notes) : clocks[blockerFields[kind]];
	return (
		trackerClockMilliseconds(clock ?? '') ||
		Date.parse(row.updated_at ?? row.created_at ?? '') ||
		nowMs
	);
}

const blockerFields = { flag: 'needs_daniel', block: 'status', 'block+flag': 'status' } as const;

function chasedAt(row: TrackerItemRow): string | null {
	const at = trackerClockMilliseconds(row.chased_clock ?? '');
	return at ? new Date(at).toISOString() : null;
}

function routeTarget(route: TrackerBlocker['route'], row: TrackerItemRow): string | null {
	if (route === 'needs_daniel') return 'Daniel';
	if (route === 'orchestrator') return row.parent ?? row.owner ?? null;
	return row.owner ?? row.parent ?? null;
}

function recheckReason(age: number, dependency: string | null, waitsOn: string | null) {
	if (waitsOn && dependency === 'done') return `${waitsOn} is done; unblock or re-verify`;
	if (age >= trackerBlockerStaleMinutes)
		return `no change for ${Math.floor(age / 60)}h; owner re-verify the blocker or unblock`;
	return null;
}

function mergeDuplicate(first: TrackerBlocker, other: TrackerBlocker): TrackerBlocker {
	const [kept, extra] = first.age_minutes >= other.age_minutes ? [first, other] : [other, first];
	return {
		...kept,
		escalated: kept.escalated || extra.escalated,
		needs_escalation: kept.needs_escalation || extra.needs_escalation,
		duplicates: [...kept.duplicates, extra.id, ...extra.duplicates]
	};
}

function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.slice(0, 160);
}
