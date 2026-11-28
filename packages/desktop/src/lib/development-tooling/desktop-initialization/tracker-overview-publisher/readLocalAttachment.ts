// @harness-uid u_ov2gw624xg
import { trackerAttachmentDocumentSchema } from '../../../../../../../src/utils/projects-sessions/trackerAttachmentDocumentBytes';
import type { WantedAttachment } from './readLocalAttachment.types';
import type { TrackerAttachmentDocument } from '../../../../../../../src/utils/projects-sessions/trackerAttachment.types';
import { trackerStructuredAsk } from '../../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import type { TrackerItem } from '../../../../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';

const trackerOrigin = 'http://127.0.0.1:7701';

/** One document from this computer's Tracker, in the exact shape its hash was taken over. */
export async function readLocalAttachment(
	wanted: WantedAttachment,
	fetcher: typeof fetch = fetch,
	scope?: 'open-ask'
): Promise<TrackerAttachmentDocument | null> {
	const { itemId, id } = wanted;
	if (typeof itemId !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(itemId)) return null;
	if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return null;
	const itemPath = `/items/${itemId}`;
	if (scope === 'open-ask' && !(await isOpenAsk(itemPath, itemId, fetcher))) return null;
	const document = await readTrackerJson(`${itemPath}/attachments/${id}`, fetcher);
	return document === null ? null : trackerAttachmentDocumentSchema.parse(document);
}

async function isOpenAsk(path: string, itemId: string, fetcher: typeof fetch): Promise<boolean> {
	const item = (await readTrackerJson(path, fetcher)) as TrackerItem | null;
	return item?.id === itemId && !item.sensitive && !item.deleted && trackerStructuredAsk(item);
}

async function readTrackerJson(path: string, fetcher: typeof fetch): Promise<unknown> {
	const response = await fetcher(trackerOrigin + path, {
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		signal: AbortSignal.timeout(5000)
	});
	if (!response.ok) {
		await response.body?.cancel();
		return null;
	}
	return response.json();
}
