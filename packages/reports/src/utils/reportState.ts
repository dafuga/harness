import type { BeginInput, Report, Status } from '../models/Report.types';
import { basename, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { cleanData } from './sanitize';
export function reportState(input: BeginInput): Report {
	if (!input.project || !input.title || !['feature', 'suite'].includes(input.mode))
		throw new Error('Project, title and valid mode are required');
	const path = resolve(input.project);
	const now = new Date().toISOString();
	return cleanData({
		schemaVersion: 1,
		id: randomUUID(),
		project: {
			id: createHash('sha256').update(path).digest('hex').slice(0, 16),
			name: basename(path),
			path
		},
		title: input.title,
		mode: input.mode,
		environment: input.environment || 'local',
		revision: input.revision,
		historical: Boolean(input.historical),
		startedAt: now,
		updatedAt: now,
		summary: input.summary || '',
		acceptance: input.acceptance || [],
		status: 'running',
		state: 'active',
		checks: [],
		evidence: [],
		findings: [],
		coverage: []
	});
}
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
