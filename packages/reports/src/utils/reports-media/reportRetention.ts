// @harness-uid u_segcni47nz
import type { Report } from '../../models/reports-media/Report.types';
import { InvalidReportRetentionTimestampError } from './reportRetention.types';
export const reportLifetimeMs = 30 * 24 * 60 * 60 * 1000;
export const reportCloudPrefixes = [
	'report-evidence/runs/',
	'uploaded-screenshots/runs/',
	'published-reports/'
];
export function reportRetention(report: Pick<Report, 'startedAt'>, now = Date.now()) {
	const created = Date.parse(report.startedAt);
	if (!Number.isFinite(created) || !Number.isFinite(now))
		throw new InvalidReportRetentionTimestampError('Invalid report retention timestamp');
	return created + reportLifetimeMs <= now;
}
