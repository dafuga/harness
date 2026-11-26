import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { trackerAttachmentDocumentSchema } from '../../../../../../src/utils/projects-sessions/trackerAttachmentDocumentBytes';
import type { OverviewBucket } from '../tracker-overview/trackerOverviewCache.types';
import { homeKey } from './homeStore';
import type { HomeWantedDocument } from './homeDocumentStore.types';

/** One upload per publish cycle keeps a first sync of many asks from stalling the Mac. */
const wantedPerPublish = 4;

/**
 * Ask documents are stored by the hash of their text, apart from the snapshot. Only those an
 * open ask names are kept: the rest are deleted, and missing ones are asked of the Mac.
 */
export async function reconcileHomeDocuments(
	bucket: OverviewBucket,
	ownerId: string,
	snapshot: Pick<OwnerHomeSnapshot, 'openAsks'>
): Promise<HomeWantedDocument[]> {
	const named = namedDocuments(snapshot);
	const stored = await readIndex(bucket, ownerId);
	const stale = stored.filter((id) => !named.has(id));
	if (stale.length) {
		await bucket.delete(await Promise.all(stale.map((id) => documentKey(ownerId, id))));
		await writeIndex(
			bucket,
			ownerId,
			stored.filter((id) => named.has(id))
		);
	}
	return [...named]
		.filter(([id]) => !stored.includes(id))
		.slice(0, wantedPerPublish)
		.map(([id, itemId]) => ({ id, itemId }));
}

/** Stores a document only when an open ask names it and its text matches that name. */
export async function storeHomeDocument(
	bucket: OverviewBucket,
	ownerId: string,
	upload: { id: string; document: unknown },
	snapshot: Pick<OwnerHomeSnapshot, 'openAsks'> | null
): Promise<boolean> {
	if (!snapshot || !namedDocuments(snapshot).has(upload.id)) return false;
	const text = JSON.stringify(trackerAttachmentDocumentSchema.parse(upload.document));
	if ((await sha256(text)) !== upload.id) return false;
	await bucket.put(await documentKey(ownerId, upload.id), text, {
		httpMetadata: { contentType: 'application/json' }
	});
	const stored = await readIndex(bucket, ownerId);
	if (!stored.includes(upload.id)) await writeIndex(bucket, ownerId, [...stored, upload.id]);
	return true;
}

export async function readHomeDocument(bucket: OverviewBucket, ownerId: string, id: string) {
	const stored = await bucket.get(await documentKey(ownerId, id));
	return stored ? trackerAttachmentDocumentSchema.parse(JSON.parse(await stored.text())) : null;
}

function namedDocuments(snapshot: Pick<OwnerHomeSnapshot, 'openAsks'>) {
	return new Map(
		(snapshot.openAsks ?? []).flatMap((ask) =>
			(ask.attachments ?? [])
				.filter((attachment) => attachment.bytes > 0)
				.map((attachment) => [attachment.id, ask.itemId] as const)
		)
	);
}

async function ownerSegment(ownerId: string) {
	return (await homeKey(ownerId)).split('/').at(-1);
}

async function documentKey(ownerId: string, id: string) {
	return `hub-home-docs/v1/${await ownerSegment(ownerId)}/${id}`;
}

async function readIndex(bucket: OverviewBucket, ownerId: string): Promise<string[]> {
	const stored = await bucket.get(`hub-home-docs/v1/${await ownerSegment(ownerId)}/index`);
	if (!stored) return [];
	const list: unknown = JSON.parse(await stored.text());
	return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
}

async function writeIndex(bucket: OverviewBucket, ownerId: string, ids: string[]) {
	await bucket.put(`hub-home-docs/v1/${await ownerSegment(ownerId)}/index`, JSON.stringify(ids), {
		httpMetadata: { contentType: 'application/json' }
	});
}

async function sha256(text: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
