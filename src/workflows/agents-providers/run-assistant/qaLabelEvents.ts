// @harness-uid u_sysofkibca
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';
import { z } from 'zod';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { QaLabelEvent } from '../../../core/agents-providers/qaThread.types';

const issues = z.array(
	z.object({ number: z.number().int().positive(), pull_request: z.unknown().optional() })
);
const events = z.array(
	z.object({
		id: z.number().int().positive(),
		event: z.string(),
		created_at: z.string(),
		label: z.object({ name: z.string() }).optional()
	})
);
const pageSize = 100;

export async function qaLabelEvents(
	github: GitHubAppAdapter,
	label: string,
	since: string,
	existingThreadIssues: readonly number[] = []
): Promise<QaLabelEvent[]> {
	const root = github.repoPath + '/issues';
	const candidates = await readPages((page) =>
		github
			.read(root, {
				state: 'open',
				labels: label,
				since,
				per_page: String(pageSize),
				page: String(page)
			})
			.then((reply) => issues.parse(reply))
	);
	const result: QaLabelEvent[] = [];
	for (const { number, pull_request } of candidates) {
		if (pull_request || existingThreadIssues.includes(number)) continue;
		const changes = await readPages((page) =>
			github
				.read(`${root}/${number}/events`, {
					per_page: String(pageSize),
					page: String(page)
				})
				.then((reply) => events.parse(reply))
		);
		const latest = changes
			.filter(
				(change) => change.label?.name === label && ['labeled', 'unlabeled'].includes(change.event)
			)
			.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id)
			.at(-1);
		if (latest?.event === 'labeled' && Date.parse(latest.created_at) >= Date.parse(since))
			result.push({ eventId: String(latest.id), issue: number });
	}
	return result;
}

async function readPages<T>(read: (page: number) => Promise<T[]>): Promise<T[]> {
	const rows: T[] = [];
	for (let page = 1; page <= 10; page++) {
		const batch = await read(page);
		rows.push(...batch);
		if (batch.length < pageSize) return rows;
	}
	throw new ProjectAssistantError('QA input exceeded its pagination bound.');
}
