import type { Evidence } from '../models/Report.types';
import { evidenceMedia } from './evidenceMedia';
type Comparable = Evidence & { phase: 'before' | 'after'; comparison: string };
function comparable(item: Evidence): item is Comparable {
	return (
		evidenceMedia(item) === 'audio' &&
		Boolean(item.comparison?.trim()) &&
		(item.phase === 'before' || item.phase === 'after')
	);
}
export function audioPairs(items: Evidence[]) {
	const groups = new Map<string, { before: Evidence[]; after: Evidence[] }>();
	for (const item of items) {
		if (!comparable(item)) continue;
		const key = JSON.stringify([item.comparison, item.viewport || '']);
		const group = groups.get(key) || { before: [], after: [] };
		group[item.phase].push(item);
		groups.set(key, group);
	}
	const pairs = new Map<string, Evidence>();
	for (const group of groups.values()) {
		if (group.before.length === 1 && group.after.length === 1)
			pairs.set(group.after[0].id, group.before[0]);
	}
	return pairs;
}
