import type { Evidence, Report } from '../../models/reports-media/Report.types';
import { evidenceMedia } from './evidenceMedia';
import { audioPairs } from '../reports-media/audioPairs';

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

export function projectFilter(run: Report, query: string, project: string) {
	return (
		(!project || run.project.id === project) &&
		`${run.project.name} ${run.title} ${run.summary}`.toLowerCase().includes(query.toLowerCase())
	);
}

export { reportFilter } from '../../components/verification-evidence/evidence-grid/reportFilter';
