import type { Report, Status } from '../../models/Report.types';

export function reportDisplay(report: Report): Status {
	if (report.state === 'finalized') return report.status;
	if (Date.now() - Date.parse(report.updatedAt) > 15 * 60_000) return 'interrupted';
	return 'running';
}
