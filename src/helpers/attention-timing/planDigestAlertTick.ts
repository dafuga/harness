// @harness-uid u_uchh2rd6vl
import type { QuietHours } from './attentionTiming.types';
import { isQuietHour } from './isQuietHour';
import { zonedWallClock } from './zonedWallClock';
import type { DigestAlertInput, DigestAlertPlan, DigestItem } from './planDigestAlertTick.types';

/** Status ticks run every 30 minutes (the LaunchAgent's StartInterval is 1800 seconds). */
const INTERVAL_MS = 30 * 60 * 1000;
const INTERVAL_MINUTES = 30;
/** No status ticks from 22:00 up to 08:00 Lisbon time. */
const QUIET: QuietHours = { tz: 'Europe/Lisbon', start: '22:00', end: '08:00' };
/** Digest lines shown per tick; the rest are counted. */
const SHOWN_LIMIT = 6;
const AGENT_CHARS = 15;
const TEXT_CHARS = 160;
const ID_CHARS = 6;
const CLOSED_STATUSES = ['done', 'ignored'];

/**
 * @pure Plan one status digest tick: the open needs-Daniel items, which of them are new since the
 * seen ids, the message to deliver and the seen ids to keep. Quiet-hour ticks and unreadable digests
 * never persist; dry runs never persist; init records seen ids without a message.
 */
export function planDigestAlertTick(input: DigestAlertInput): DigestAlertPlan {
	const { nowMs, mode, items, seenIds } = input;
	const quietHeld = mode === 'tick' && isQuietHour(nowMs, QUIET);
	const flagged = items === null ? [] : flaggedItems(items);
	const seen = new Set(seenIds);
	const fresh = flagged.filter((item) => !seen.has(item.id));
	const message =
		mode === 'init' || quietHeld
			? null
			: statusMessage(nowMs, fresh, flagged.length, items !== null);
	const persists = mode !== 'dry-run' && !quietHeld && items !== null;
	return {
		mode,
		quietHeld,
		message,
		flaggedCount: flagged.length,
		newIds: fresh.map((item) => item.id),
		nextSeenIds: persists ? sortedUnion(seenIds, flagged) : null,
		nextTickAtMs: nowMs + INTERVAL_MS
	};
}

/** @pure Open needs-Daniel items, one per id (last occurrence wins), sorted by id so output never depends on input order. Ids are unique after the map, so the comparison never ties. */
function flaggedItems(items: readonly DigestItem[]): DigestItem[] {
	const byId = new Map<string, DigestItem>();
	for (const item of items) {
		if (isOpenNeedsDaniel(item)) byId.set(item.id, item);
	}
	return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** @pure An item that needs Daniel, is not closed or ignored, and is not deleted. */
function isOpenNeedsDaniel(item: DigestItem): boolean {
	return (
		Boolean(item.needs_daniel) && !CLOSED_STATUSES.includes(item.status ?? '') && !item.deleted
	);
}

/** @pure Ids from seenIds and the flagged items, sorted and without duplicates. */
function sortedUnion(seenIds: readonly string[], flagged: readonly DigestItem[]): string[] {
	return [...new Set([...seenIds, ...flagged.map((item) => item.id)])].sort();
}

/** @pure The tick text: time in Lisbon, what is new, the open total and the instruction to the Chief of Staff. */
function statusMessage(
	nowMs: number,
	fresh: readonly DigestItem[],
	openCount: number,
	reachable: boolean
): string {
	const wall = zonedWallClock(nowMs, QUIET.tz);
	const clock = `${pad2(wall.hour)}:${pad2(wall.minute)}`;
	const news = reachable ? newSummary(fresh) : 'Local tracker unreachable this tick.';
	return (
		`${INTERVAL_MINUTES}-MIN STATUS TICK ${clock} Lisbon (automated, from tracker-alert.py, not typed by Daniel). ` +
		`${news} Open needs-Daniel total: ${openCount}. ` +
		`Give Daniel the ${INTERVAL_MINUTES}-minute status per the tracker skill (every project one line, resources, quota, To unblock list); ` +
		'handle routing yourself; then wait for his instructions.'
	);
}

/** @pure "New since last tick" with up to six lines, or the no-new sentence. */
function newSummary(fresh: readonly DigestItem[]): string {
	if (!fresh.length) return 'No new needs-Daniel items since last tick.';
	const lines = fresh.slice(0, SHOWN_LIMIT).map(digestLine);
	const hidden = fresh.length - SHOWN_LIMIT;
	const more = hidden > 0 ? ` (+${hidden} more)` : '';
	return `New since last tick: ${lines.join(' | ')}${more}.`;
}

/** @pure One item as "[id] agent: question, or the title when the question is empty". */
function digestLine(item: DigestItem): string {
	const id = safeText(item.id, ID_CHARS);
	const agent = safeText(item.agent, AGENT_CHARS);
	const text = safeText([item.question, item.title].find(Boolean), TEXT_CHARS);
	return `[${id}] ${agent}: ${text}`;
}

/** @pure Collapse whitespace and control characters to single spaces, trim, then cut to a code-point limit. */
function safeText(value: string | null | undefined, limit: number): string {
	const collapsed = (value ?? '').replace(/[\s\p{Cc}]+/gu, ' ').trim();
	return Array.from(collapsed).slice(0, limit).join('');
}

/** @pure Two-digit zero padding for clock fields. */
function pad2(value: number): string {
	return String(value).padStart(2, '0');
}
