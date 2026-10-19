import type { HistoryEvent } from '../../models/Desktop.types';

/** Pages of one entity's history in the order they were read; an event is listed once. */
export function historyPages(...pages: HistoryEvent[][]): HistoryEvent[] {
	const seen = new Set<string>();
	return pages.flat().filter((event) => {
		if (seen.has(event.id)) return false;
		seen.add(event.id);
		return true;
	});
}
