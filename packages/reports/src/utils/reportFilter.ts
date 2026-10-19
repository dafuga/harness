import type { Evidence, Report } from '../models/Report.types';
import { evidenceMedia } from './evidenceMedia';
import { audioPairs } from './audioPairs';
export type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'other';
export function screenSize(item: Evidence): ScreenSize {
	const viewport = (item.viewport || '').toLowerCase();
	if (/mobile|phone|iphone/.test(viewport)) return 'mobile';
	if (/tablet|ipad/.test(viewport)) return 'tablet';
	if (/desktop|laptop/.test(viewport)) return 'desktop';
	const width = Number(viewport.match(/\d+/)?.[0]);
	if (width > 0) {
		if (width < 700) return 'mobile';
		if (width < 1100) return 'tablet';
		return 'desktop';
	}
	return 'other';
}
export function galleryEvidence(items: Evidence[], pairs = audioPairs(items)) {
	const pairedBefore = new Set([...pairs.values()].map((item) => item.id));
	return items.filter(
		(item) =>
			item.phase !== 'before' || (evidenceMedia(item) === 'audio' && !pairedBefore.has(item.id))
	);
}
export interface Filters {
	search: string;
	category: string;
	phase: string;
	status: string;
}
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
export function projectFilter(run: Report, query: string, project: string) {
	return (
		(!project || run.project.id === project) &&
		`${run.project.name} ${run.title} ${run.summary}`.toLowerCase().includes(query.toLowerCase())
	);
}
