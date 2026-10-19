import type { Report, Status } from "../models/Report.types";

export function resultStatus(report: Report): Status {
	const statuses = [
		...report.checks,
		...report.findings,
		...report.coverage,
		...report.evidence
	].map((item) => item.status);
	if (statuses.includes('failed')) return 'failed';
	if (statuses.some((value) => ['blocked', 'not-proven', 'interrupted', 'running'].includes(value)))
		return 'blocked';
	if (!report.checks.length) return 'not-proven';
	if (report.checks.every((check) => check.status === 'skipped')) return 'skipped';
	return 'passed';
}

export function interrupted(report: Report) {
	return report.state !== 'finalized' && Date.now() - Date.parse(report.updatedAt) > 15 * 60_000;
}

export { reportState } from '../repositories/report-repository/reportState';
