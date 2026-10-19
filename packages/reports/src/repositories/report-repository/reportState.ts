import type { BeginInput, Report } from '../../models/Report.types.ts';
import { basename, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { cleanData } from '../../utils/sanitize';

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
