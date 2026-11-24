// @harness-uid u_ymhr4iqr7u
import {
	trackerPlanningSchema,
	trackerStageSchema
} from '../../../../../../src/utils/projects-sessions/trackerPlanning';
import type {
	InboxDetail,
	InboxFlag,
	InboxHeader,
	InboxNote,
	InboxRun,
	InboxWrite
} from '../../../models/development-tooling/TrackerInbox.types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function nullableText(value: unknown): string | null {
	return value === null || value === undefined ? null : text(value);
}

function num(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Returns the parsed value, or null when any required field is missing. Never throws. */
export function parseHeader(value: unknown): InboxHeader | null {
	if (!isRecord(value)) return null;
	const id = text(value.id);
	const title = text(value.title);
	const project = text(value.project);
	const status = text(value.status);
	const stage = trackerStageSchema.safeParse(value.stage);
	if (id === null || title === null || project === null || status === null) return null;
	return {
		id,
		title,
		project,
		status,
		...(stage.success && { stage: stage.data }),
		updatedAt: nullableText(value.updatedAt),
		dueAt: nullableText(value.dueAt)
	};
}

export function parseHeaders(value: unknown): InboxHeader[] {
	if (!Array.isArray(value)) return [];
	return value.map(parseHeader).filter((header): header is InboxHeader => header !== null);
}

function parseFlag(value: unknown): InboxFlag | null {
	if (!isRecord(value)) return null;
	const state = text(value.state);
	const question = text(value.question);
	if (state === null || question === null) return null;
	return { state, at: nullableText(value.at), question };
}

function parseNotes(value: unknown): InboxNote[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((note) => {
		if (!isRecord(note)) return [];
		const id = text(note.id);
		const author = text(note.author);
		const at = text(note.at);
		const body = text(note.text);
		return id !== null && author !== null && at !== null && body !== null
			? [{ id, author, at, text: body }]
			: [];
	});
}

function parseRuns(value: unknown): InboxRun[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((run) => {
		if (!isRecord(run)) return [];
		const id = text(run.id);
		const origin = text(run.origin);
		const state = text(run.state);
		if (id === null || origin === null || state === null) return [];
		return [
			{
				id,
				origin,
				state,
				outcome: nullableText(run.outcome),
				queuedAt: num(run.queuedAt),
				startedAt: num(run.startedAt),
				endedAt: num(run.endedAt)
			}
		];
	});
}

/** Reads `tracker_show` data. An item without a valid header yields null. */
export function parseDetail(data: unknown): InboxDetail | null {
	if (!isRecord(data)) return null;
	const header = parseHeader(data.item);
	if (header === null) return null;
	const planning = trackerPlanningSchema.safeParse(data.planning);
	return {
		header,
		...(planning.success && { planning: planning.data }),
		notes: parseNotes(data.notes),
		flag: parseFlag(data.flag),
		runs: parseRuns(data.runs),
		revision: nullableText(data.attentionRevision)
	};
}

export function parseWrites(data: unknown): InboxWrite[] {
	const writes = isRecord(data) ? data.writes : undefined;
	if (!Array.isArray(writes)) return [];
	return writes.flatMap((write) => {
		if (!isRecord(write)) return [];
		const intentId = text(write.intentId);
		const itemId = text(write.itemId);
		const status = text(write.status);
		if (intentId === null || itemId === null) return [];
		if (status !== 'queued' && status !== 'conflict' && status !== 'accepted') return [];
		return [{ intentId, itemId, status, reason: text(write.reason) ?? '' }];
	});
}
