import { Filters } from '../../utils/reportFilter';
import type { Evidence } from "../../models/Report.types.ts";

export function reportFilter(
	items: Evidence[],
	filter: Filters,
	pairs?: ReadonlyMap<string, Evidence>
) {
	return items
		.filter((item) => {
			const before = pairs?.get(item.id);
			return matchesEvidence(item, filter) || Boolean(before && matchesEvidence(before, filter));
		})
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function matchesEvidence(item: Evidence, filter: Filters) {
	return (
		(!filter.category || item.category === filter.category) &&
		(!filter.phase || item.phase === filter.phase) &&
		(!filter.status || item.status === filter.status) &&
		[item.title, item.note, item.category, item.viewport, item.source, item.transcript]
			.join(' ')
			.toLowerCase()
			.includes(filter.search.toLowerCase())
	);
}
