// @harness-uid u_ov2gw624xg
import { trackerAttachmentDocumentSchema } from '../../../../../../../src/utils/projects-sessions/trackerAttachmentDocumentBytes';
import type { TrackerAttachmentDocument } from '../../../../../../../src/utils/projects-sessions/trackerAttachment.types';

/** As another party named it, so both parts are checked before they reach an address. */
type WantedAttachment = { itemId?: string; id?: string };

const trackerOrigin = 'http://127.0.0.1:7701';

/** One document from this computer's Tracker, in the exact shape its hash was taken over. */
export async function readLocalAttachment(
	wanted: WantedAttachment,
	fetcher: typeof fetch = fetch
): Promise<TrackerAttachmentDocument | null> {
	const { itemId, id } = wanted;
	if (typeof itemId !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(itemId)) return null;
	if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return null;
	const response = await fetcher(`${trackerOrigin}/items/${itemId}/attachments/${id}`, {
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		signal: AbortSignal.timeout(5000)
	});
	if (!response.ok) {
		await response.body?.cancel();
		return null;
	}
	return trackerAttachmentDocumentSchema.parse(await response.json());
}
