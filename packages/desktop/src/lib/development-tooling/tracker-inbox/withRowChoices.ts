// @harness-uid u_ami3bcrae3
import type {
	InboxRow,
	TrackerInboxSource
} from '../../../models/development-tooling/TrackerInbox.types';

/**
 * Reads the item behind each Needs you row, so the row can show the ask's choices. The row then
 * shows the question of that same read, and a tap answers exactly that revision. A row whose item
 * cannot be read keeps its question and opens the item instead.
 */
export async function withRowChoices(
	source: Pick<TrackerInboxSource, 'detail'>,
	rows: InboxRow[]
): Promise<InboxRow[]> {
	return Promise.all(
		rows.map(async (row) => {
			if (!row.ask) return row;
			const detail = (await source.detail(row.header.id).catch(() => null))?.value;
			if (detail?.flag?.state !== 'open' || !detail.flag.options) return row;
			return { ...row, ask: { ...row.ask, question: detail.flag.question }, review: detail };
		})
	);
}
