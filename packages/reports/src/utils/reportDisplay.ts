import type { Report, Status } from '../models/Report.types';
export function reportDisplay(report: Report): Status {
	if (report.state === 'finalized') return report.status;
	if (Date.now() - Date.parse(report.updatedAt) > 15 * 60_000) return 'interrupted';
	return 'running';
}
/**
 * Whether an unfinished report still receives updates. This says nothing about its outcome:
 * what was recorded stays what is shown, and a report gone quiet is marked as such beside it.
 */
export function reportStale(report: Report, now = Date.now()): boolean {
	return report.state !== 'finalized' && now - Date.parse(report.updatedAt) > 15 * 60_000;
}
export function dateLabel(value: string) {
	return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
export function timeAgo(value: string, now = Date.now()) {
	const elapsed = now - Date.parse(value);
	if (!Number.isFinite(elapsed)) return '';
	if (elapsed < 60_000) return 'just now';
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['year', 365 * 24 * 60 * 60_000],
		['month', 30 * 24 * 60 * 60_000],
		['week', 7 * 24 * 60 * 60_000],
		['day', 24 * 60 * 60_000],
		['hour', 60 * 60_000],
		['minute', 60_000]
	];
	const [unit, duration] = units.find(([, duration]) => elapsed >= duration)!;
	return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
		-Math.floor(elapsed / duration),
		unit
	);
}
export function evidenceAnchor(id: string) {
	return `evidence-${id}`;
}
