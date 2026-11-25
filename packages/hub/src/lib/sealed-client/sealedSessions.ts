// @harness-uid u_thdvp7j4r2
import type { ScopeKeys } from '../../../../remote/src/models/networking-security/Sealed.types';
import {
	fromBase64Url,
	toBase64Url
} from '../../../../remote/src/utils/networking-security/remoteBytes';
import {
	openSealedRecord,
	sealedRecordHeader
} from '../../../../remote/src/utils/networking-security/sealedRecord';
import { sealedObjectId } from '../../../../remote/src/utils/networking-security/sealedScopeKeys';
import type { SealedObject } from './SealedBrowserCache.types';
import type {
	SealedSession,
	SessionPayload,
	SessionRecord,
	SessionStatus,
	TranscriptSegment
} from './sealedSessions.types';

function statusRecord(value: SessionPayload): value is SessionStatus {
	return (
		value.kind === 'session' &&
		typeof value.runId === 'string' &&
		value.runId.length > 0 &&
		typeof value.streamId === 'string' &&
		/^[\w-]{22}$/.test(value.streamId) &&
		typeof value.status === 'string'
	);
}

function segmentRecord(value: SessionPayload): value is TranscriptSegment {
	return (
		value.kind === 'transcript' &&
		typeof value.runId === 'string' &&
		value.runId.length > 0 &&
		Number.isSafeInteger(value.index) &&
		Number(value.index) >= 0 &&
		typeof value.data === 'string' &&
		/^[A-Za-z0-9_-]*$/.test(value.data) &&
		value.data.length % 4 !== 1
	);
}

async function sessionRecord(
	object: SealedObject,
	keys: (epoch: number) => Promise<ScopeKeys | undefined>
): Promise<SessionRecord | null> {
	try {
		const bytes = fromBase64Url(object.envelope);
		const header = sealedRecordHeader(bytes);
		const epoch = await keys(header.epoch);
		if (
			!epoch ||
			toBase64Url(header.objectId) !== object.id ||
			header.revision !== BigInt(object.revision)
		)
			return null;
		const { value } = await openSealedRecord<SessionPayload>(epoch, bytes);
		if (!value || typeof value !== 'object') return null;
		const record = statusRecord(value) || segmentRecord(value) ? value : null;
		if (!record) return null;
		const id =
			record.kind === 'session' ? record.runId : JSON.stringify([record.runId, record.index]);
		if (toBase64Url(await sealedObjectId(epoch, record.kind, id)) !== object.id) return null;
		return record;
	} catch {
		return null;
	}
}

function joinSegments(segments: TranscriptSegment[]): string {
	const decoder = new TextDecoder();
	let text = '';
	for (const segment of segments.sort((left, right) => left.index - right.index))
		text += decoder.decode(fromBase64Url(segment.data), { stream: true });
	return text + decoder.decode();
}

function sessionTitle(status: SessionStatus): string {
	const details = status.details;
	return details &&
		typeof details === 'object' &&
		'title' in details &&
		typeof details.title === 'string'
		? details.title
		: status.runId;
}

/** Decrypt a scope's publisher envelopes and project only status and transcript records. */
export async function sealedSessions(
	scope: string,
	objects: SealedObject[],
	keys: (epoch: number) => Promise<ScopeKeys | undefined>
): Promise<SealedSession[]> {
	const records = await Promise.all(objects.map((object) => sessionRecord(object, keys)));
	const segments = new Map<string, TranscriptSegment[]>();
	const statuses: SessionStatus[] = [];
	for (const record of records) {
		if (record?.kind === 'session') statuses.push(record);
		if (record?.kind !== 'transcript') continue;
		const entries = segments.get(record.runId);
		if (entries) entries.push(record);
		else segments.set(record.runId, [record]);
	}
	return statuses.map((status) => ({
		id: JSON.stringify([scope, status.runId]),
		scope,
		streamId: status.streamId,
		title: sessionTitle(status),
		status: status.status,
		transcript: joinSegments(segments.get(status.runId) ?? [])
	}));
}
