import type { HistoryEvent } from '../../../desktop/src/models/Desktop.types';
import type { HubSourceContext } from './hubSource';
import { hubFail } from './hubJson';
export interface HubHistoryPage {
	entries: HistoryEvent[];
	complete: boolean;
	nextPage: number | null;
}
export async function hubHistory(
	context: HubSourceContext,
	input: { branch?: string; paths: string[]; page?: number }
): Promise<HubHistoryPage> {
	if (!context.source.historyPage) return hubFail('history-unavailable');
	const result = await context.source.historyPage(context.repository, {
		commit: context.commit,
		paths: input.paths,
		page: input.page ?? 1,
		perPage: 20
	});
	return {
		complete: result.complete,
		nextPage: result.nextPage,
		entries: result.commits
			.map((commit) => ({
				id: commit.hash,
				at: commit.authoredAt,
				kind: 'commit' as const,
				title: commit.subject,
				detail: 'Committed change. Measurements and verification are recorded separately.',
				commit: commit.hash,
				version: null
			}))
			.sort((a, b) => b.at.localeCompare(a.at))
	};
}
