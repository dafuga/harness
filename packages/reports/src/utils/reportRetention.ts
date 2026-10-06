import type { Report } from '../models/Report.types';
export const reportLifetimeMs = 30 * 24 * 60 * 60 * 1000;
export const reportCloudPrefixes = [
	'report-evidence/runs/',
	'uploaded-screenshots/runs/',
	'published-reports/'
];
export function reportRetention(report: Pick<Report, 'startedAt'>, now = Date.now()) {
	const created = Date.parse(report.startedAt);
	if (!Number.isFinite(created) || !Number.isFinite(now))
		throw new Error('Invalid report retention timestamp');
	return created + reportLifetimeMs <= now;
}
