// @harness-uid u_atgwulv6mc
import type { InboxDetail } from '../../../models/development-tooling/TrackerInbox.types';
import { readLocalAttachment } from './tracker-overview-publisher/readLocalAttachment';

/** The Mac reads its own Tracker, so the open ask's documents come with the item. */
export async function withLocalDocuments(detail: InboxDetail): Promise<InboxDetail> {
	const { flag, header } = detail;
	if (!flag?.attachments) return detail;
	const attachments = await Promise.all(
		flag.attachments.map(async (listing) => {
			const wanted = { itemId: header.id, id: listing.id };
			const content = listing.bytes ? await readLocalAttachment(wanted).catch(() => null) : null;
			return content ? { ...listing, content } : listing;
		})
	);
	return { ...detail, flag: { ...flag, attachments } };
}
