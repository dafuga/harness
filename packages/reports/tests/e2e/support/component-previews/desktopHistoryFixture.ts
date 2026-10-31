import type { EntityDetail, HistoryEvent } from '../../../../../desktop/src/models/Desktop.types';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

/** Meaningful history for the invented orders application's filtering function. */
export function desktopHistoryFixture(entity: EntityDetail, variant: string): EntityDetail {
	const history: HistoryEvent[] = [
		{
			id: 'filter-search-implementation',
			at: '2026-10-10T10:24:00Z',
			kind: 'commit',
			title: 'Add case-insensitive order search',
			detail:
				'Order names now match queries regardless of letter case. Empty queries return every order and matching rows keep their original order.',
			commit: commits.middle,
			version: null
		},
		{
			id: 'filter-plan-approved',
			at: '2026-10-09T14:10:00Z',
			kind: 'approval',
			title: 'Approve the filtering plan',
			detail:
				'Approved the query-normalization plan and its public input matrix. The design covers empty queries and preserves the order of matching rows.',
			commit: commits.plan,
			version: null
		}
	];
	if (variant === 'long')
		history[0].detail = [
			'The search query is normalized once before the order list is filtered.',
			'Matching ignores letter case, returns the original row objects and leaves caller-owned data unchanged.',
			'The public input matrix covers an empty query, no matches and customer names containing spaces.',
			'Reviewers can compare each observed result with the original input order before accepting the change.'
		].join(' ');
	return { ...entity, history: variant === 'empty' ? [] : history };
}

export function earlierDesktopHistoryEvent(): HistoryEvent {
	return {
		id: 'filter-search-api-decision',
		at: '2026-10-08T08:45:00Z',
		kind: 'design',
		title: 'Earlier API decision',
		detail:
			'The filter accepts an order array and a search string. Keep it synchronous so the list can update as the user types.',
		commit: commits.first,
		version: null
	};
}
