// @harness-uid u_dpbqtddngd
import type { TrackerItem } from '../../../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import { sanitizeTrackerText } from '../../../../../../src/utils/projects-sessions/sanitizeTrackerText';
import type {
	ConfirmedWrite,
	InboxDetail,
	InboxOverview,
	InboxReply,
	InboxRow,
	InboxWriteReceipt
} from '../../../models/development-tooling/TrackerInbox.types';
import { withLocalDocuments } from './macTrackerInboxDocuments';
import {
	projectDetail,
	projectHeader,
	safe,
	safeItemId,
	visible
} from './macTrackerInboxProjection';
import { confirmedWrite, itemBucket, matchesQuery } from '../tracker-inbox/trackerInbox';
import type { TrackerInboxItemReply, TrackerInboxReadInput } from './MacTrackerInboxService.types';

const trackerOrigin = 'http://127.0.0.1:7701';

export class MacTrackerInboxService {
	async read(
		input: TrackerInboxReadInput
	): Promise<InboxReply<InboxOverview | InboxRow[] | InboxDetail>> {
		switch (input.operation) {
			case 'overview':
				return this.overview();
			case 'search':
				return typeof input.query === 'string' && input.query.length <= 160
					? this.search(input.query)
					: current({ code: 'invalidInput' });
			case 'detail':
				return typeof input.id === 'string' && safeItemId.test(input.id)
					? this.detail(input.id)
					: current({ code: 'invalidInput' });
			default:
				return current({ code: 'invalidInput' });
		}
	}

	async write(input: Partial<ConfirmedWrite>): Promise<InboxReply<InboxWriteReceipt>> {
		const write = parseWrite(input);
		if (!write) return current({ code: 'invalidInput' });
		const { id, ...fields } = write;
		// The write exists only after the page's explicit confirm step, so it is a confirmed one.
		const body = write.option === undefined ? fields : { ...fields, confirmed: true };
		try {
			const response = await trackerRequest(`/items/${id}/inbox`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) return current({ code: await writeError(response) });
			const result = (await response.json()) as { status?: string };
			return result.status === 'accepted'
				? current({ value: { status: 'accepted' } })
				: unavailable();
		} catch {
			return unavailable();
		}
	}

	private async overview(): Promise<InboxReply<InboxOverview>> {
		try {
			const rows = await readRows();
			const unresolvedFlags = rows.filter(({ bucket }) => bucket === 'needs-you').length;
			return current({ value: { rows, unresolvedFlags, needsYouCapped: false } });
		} catch {
			return unavailable();
		}
	}

	private async search(query: string): Promise<InboxReply<InboxRow[]>> {
		try {
			const rows = await readRows();
			return current({ value: rows.filter((row) => matchesQuery(row, query)) });
		} catch {
			return unavailable();
		}
	}

	private async detail(id: string): Promise<InboxReply<InboxDetail>> {
		try {
			const response = await trackerRequest(`/items/${id}/inbox`);
			if (response.status === 404) {
				await response.body?.cancel();
				return current({ code: 'noLocalMatch' });
			}
			const detail = await readReply<TrackerInboxItemReply>(response);
			return detail.item.id === id && visible(detail.item)
				? current({ value: await withLocalDocuments(projectDetail(detail)) })
				: current({ code: 'noLocalMatch' });
		} catch {
			return unavailable();
		}
	}
}

function parseWrite(input: Partial<ConfirmedWrite>): ConfirmedWrite | null {
	const { action, id, text, revision, option } = input;
	if (
		(action !== 'note' && action !== 'flag' && action !== 'answer') ||
		typeof id !== 'string' ||
		!safeItemId.test(id) ||
		typeof text !== 'string' ||
		(revision !== null && typeof revision !== 'string') ||
		(option !== undefined && !(Number.isInteger(option) && option >= 1 && option <= 4))
	)
		return null;
	return confirmedWrite({ action, id, text, revision, option }, true);
}

function trackerRequest(path: string, init?: RequestInit): Promise<Response> {
	return fetch(trackerOrigin + path, {
		...init,
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		signal: AbortSignal.timeout(5000)
	});
}

async function readReply<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	await response.body?.cancel();
	throw new TypeError('Tracker did not return item data');
}

async function readRows(): Promise<InboxRow[]> {
	const items = await readReply<TrackerItem[]>(await trackerRequest('/items?status=all&limit=-1'));
	return items.filter((item) => visible(item)).map(projectRow);
}

function projectRow(item: TrackerItem): InboxRow {
	const open = trackerStructuredAsk(item);
	return {
		header: projectHeader(item),
		bucket: itemBucket(item.status ?? 'open', open),
		...(open && {
			ask: { question: safe(item.question), since: item.asked_at ?? item.updated_at }
		})
	};
}

async function writeError(response: Response): Promise<string> {
	const { code } = (await response.json()) as { code?: string };
	if (code === 'staleReview') return code;
	if (response.status === 404) return 'noLocalMatch';
	if (response.status === 400) return 'invalidInput';
	if (response.status === 409) return 'writeConflict';
	return 'unavailable';
}

function current<T>(result: { value?: T; code?: string }): InboxReply<T> {
	return { ...result, freshness: 'current', lastSyncedAt: null, partial: false };
}

function unavailable(): InboxReply<never> {
	return { code: 'unavailable', freshness: 'unavailable', lastSyncedAt: null, partial: true };
}
