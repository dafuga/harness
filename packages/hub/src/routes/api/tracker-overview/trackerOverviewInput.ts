// @harness-uid u_k4rxbz6pq3
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';
import { hubFail } from '../../../utils/development-tooling/hubJson';
import type {
	OverviewPayload,
	OverviewRecord,
	ReadyOverviewPayload
} from './trackerOverviewInput.types';

/** The whole request body, counted as bytes on the wire. Checked before any parsing. */
export const MAX_BODY_BYTES = 256 * 1024;

const STATES = ['needs-you', 'blocked', 'active', 'quiet', 'done'] as const;
const ITEM_STATUSES = ['open', 'in_progress', 'blocked', 'done'] as const;
const MACHINE_STATUSES = ['ok', 'busy', 'overloaded', 'offline'] as const;
const MAX_PROJECTS = 500;
const MAX_ITEMS = 200;
const MAX_MACHINES = 200;
const MAX_COUNT = 1_000_000;
const REDACTED = '[redacted]';

/** Reads the body, refusing as soon as it passes the byte limit. Only a JSON body is accepted. */
export async function readOverviewText(
	request: Request,
	maximum: number = MAX_BODY_BYTES
): Promise<string> {
	assertJsonLength(request, maximum);
	const reader = request.body?.getReader();
	if (!reader) return invalid();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (let part = await reader.read(); !part.done; part = await reader.read()) {
		size += part.value.byteLength;
		if (size > maximum) {
			await reader.cancel();
			tooLarge();
		}
		chunks.push(part.value);
	}
	return decode(chunks, size);
}

function assertJsonLength(request: Request, maximum: number) {
	if (!request.headers.get('Content-Type')?.startsWith('application/json')) invalid();
	const declared = request.headers.get('Content-Length');
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) tooLarge();
}

/** Parses and checks one snapshot. Only the display allowlist is kept; anything else is refused. */
export function parseOverviewPayload(text: string): OverviewPayload {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return invalid();
	}
	const body = objectOf(value);
	if (body.status !== 'unavailable') return ready(body);
	record(body, ['status']);
	return { status: 'unavailable' };
}

/** A ready snapshot whose cards agree with its totals. Used for PUT and for stored data alike. */
export function readySnapshot(value: OverviewRecord): ReadyOverviewPayload {
	return ready(objectOf(value));
}

function decode(chunks: Uint8Array[], size: number): string {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const part of chunks) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return invalid();
	}
}

function ready(value: OverviewRecord): ReadyOverviewPayload {
	const body = record(value, ['status', 'projects', 'machines', 'liveSessions']);
	if (body.status !== 'ready') invalid();
	const projects = list(body.projects, MAX_PROJECTS).map(card);
	const agents = new Set(projects.map((project) => project.agent));
	const live = projects.reduce((sum, project) => sum + project.liveSessions, 0);
	if (agents.size !== projects.length || live !== count(body.liveSessions)) invalid();
	return {
		status: 'ready',
		projects,
		machines: list(body.machines, MAX_MACHINES).map(machine),
		liveSessions: live
	};
}

function card(value: unknown) {
	const body = record(value, [
		'agent',
		'state',
		'liveSessions',
		'counts',
		'items',
		'attention',
		'blocked',
		'milestone',
		'updatedAt'
	]);
	return {
		agent: identifier(body.agent, 200),
		state: oneOf(body.state, STATES),
		liveSessions: count(body.liveSessions),
		counts: counts(body.counts),
		items: list(body.items, MAX_ITEMS).map(item),
		attention: callout(body.attention),
		blocked: callout(body.blocked),
		milestone: milestone(body.milestone),
		updatedAt: time(body.updatedAt)
	};
}

function item(value: unknown) {
	const body = record(value, ['id', 'title', 'status', 'updatedAt', 'due', 'live', 'stale']);
	return {
		id: identifier(body.id, 200),
		title: excerpt(body.title, 500),
		status: oneOf(body.status, ITEM_STATUSES),
		updatedAt: time(body.updatedAt),
		due: body.due === null ? null : time(body.due),
		live: flag(body.live),
		stale: flag(body.stale)
	};
}

function callout(value: unknown) {
	if (value === null) return null;
	const body = record(value, ['item', 'text']);
	return { item: item(body.item), text: excerpt(body.text, 1000) };
}

function milestone(value: unknown) {
	if (value === null) return null;
	const body = record(value, ['text', 'at']);
	return { text: excerpt(body.text, 1000), at: time(body.at) };
}

function machine(value: unknown) {
	const body = record(value, ['name', 'status']);
	return {
		name: identifier(body.name, 200),
		status: oneOf(body.status, MACHINE_STATUSES)
	};
}

function counts(value: unknown) {
	const body = record(value, ITEM_STATUSES);
	const entries = ITEM_STATUSES.map((key) => [key, count(body[key])]);
	return Object.fromEntries(entries) as Record<(typeof ITEM_STATUSES)[number], number>;
}

function objectOf(value: unknown): OverviewRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
	return value as OverviewRecord;
}

/** An exact key set: no missing key and no extra one. */
function record(value: unknown, keys: readonly string[]): OverviewRecord {
	const body = objectOf(value);
	const exact = Object.keys(body).length === keys.length && keys.every((key) => key in body);
	return exact ? body : invalid();
}

function list(value: unknown, max: number): unknown[] {
	if (!Array.isArray(value) || value.length > max) return invalid();
	return value;
}

/** An identifier or name: refused when longer than its limit, with credentials replaced by the marker. */
function identifier(value: unknown, max: number): string {
	if (typeof value !== 'string' || value.length > max) return invalid();
	return sanitizeText(value);
}

/** Free text: redacted in full first, so no credential can cross the cut, then cut with an ending. */
function excerpt(value: unknown, max: number): string {
	if (typeof value !== 'string') return invalid();
	const clean = sanitizeText(value);
	return clean.length <= max ? clean : clean.slice(0, cutAt(clean, max - 1)) + '…';
}

function cutAt(value: string, end: number): number {
	const marker = value.lastIndexOf(REDACTED, end - 1);
	if (marker !== -1 && marker + REDACTED.length > end) return marker;
	return /[\uD800-\uDBFF]/.test(value.charAt(end - 1)) ? end - 1 : end;
}

function time(value: unknown): string {
	if (typeof value !== 'string' || value.length > 40) return invalid();
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? invalid() : new Date(parsed).toISOString();
}

function count(value: unknown): number {
	const ok = typeof value === 'number' && Number.isSafeInteger(value);
	return ok && value >= 0 && value <= MAX_COUNT ? value : invalid();
}

function flag(value: unknown): boolean {
	return typeof value === 'boolean' ? value : invalid();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
	const known = typeof value === 'string' && (allowed as readonly string[]).includes(value);
	return known ? (value as T) : invalid();
}

function invalid(): never {
	return hubFail('invalid-input');
}

function tooLarge(): never {
	return hubFail('artifact-too-large');
}
