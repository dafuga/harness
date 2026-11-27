// @harness-uid u_dpbqtddngd
import type { TrackerItem } from '../../../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type {
	ConfirmedWrite,
	InboxDetail,
	InboxOverview,
	InboxReply,
	InboxRow,
	InboxWriteReceipt
} from '../../../models/development-tooling/TrackerInbox.types';
import { withLocalDocuments } from './macTrackerInboxDocuments';
import { macReminderWrite } from './macReminderWrite';
import { confirmedWrite, matchesQuery } from '../tracker-inbox/trackerInbox';
import { reminderHeaders } from '../tracker-inbox/trackerReminders';
import type { TrackerInboxItemReply, TrackerInboxReadInput } from './MacTrackerInboxService.types';
import { projectDetail, projectRow, safeId, visible } from './macTrackerInboxProjection';
import {
	current,
	liveState,
	readReply,
	trackerRequest,
	unavailable,
	writeError
} from './macTrackerRequest';

export class MacTrackerInboxService {
	async read(
		input: TrackerInboxReadInput
	): Promise<InboxReply<InboxOverview | InboxRow[] | InboxDetail>> {
		switch (input.operation) {
			case 'live':
				return liveState();
			case 'overview':
				return this.overview();
			case 'search':
				return typeof input.query === 'string' && input.query.length <= 160
					? this.search(input.query)
					: current({ code: 'invalidInput' });
			case 'detail':
				return typeof input.id === 'string' && safeId.test(input.id)
					? this.detail(input.id)
					: current({ code: 'invalidInput' });
			default:
				return current({ code: 'invalidInput' });
		}
	}

	async write(input: Partial<ConfirmedWrite>): Promise<InboxReply<InboxWriteReceipt>> {
		if (input.action === 'done' || input.action === 'remind') return macReminderWrite(input);
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
			const reminders = reminderHeaders(rows.map((row) => row.header));
			return current({ value: { rows, reminders, unresolvedFlags, needsYouCapped: false } });
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

function writeAction(action: unknown): action is ConfirmedWrite['action'] {
	return action === 'note' || action === 'flag' || action === 'answer';
}

/** No tapped option, or one of the four an ask can offer. */
function optionNumber(option: number | undefined): boolean {
	return option === undefined || (Number.isInteger(option) && option >= 1 && option <= 4);
}

function parseWrite(input: Partial<ConfirmedWrite>): ConfirmedWrite | null {
	const { action, id, text, revision, option } = input;
	if (
		!writeAction(action) ||
		typeof id !== 'string' ||
		!safeId.test(id) ||
		typeof text !== 'string' ||
		(revision !== null && typeof revision !== 'string') ||
		!optionNumber(option)
	)
		return null;
	return confirmedWrite({ action, id, text, revision, option }, true);
}

async function readRows(): Promise<InboxRow[]> {
	const items = await readReply<TrackerItem[]>(await trackerRequest('/items?status=all&limit=-1'));
	return items.filter((item) => visible(item)).map(projectRow);
}
