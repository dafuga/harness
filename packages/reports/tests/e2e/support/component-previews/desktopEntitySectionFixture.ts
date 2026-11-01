import type { DesktopData } from './desktopData.svelte';
import type { HistoryEvent, Relationship } from '../../../../../desktop/src/models/Desktop.types';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

const relationships: Relationship[] = [
	{
		id: 'app.api.list-orders',
		title: 'GET /api/orders',
		category: 'apis',
		direction: 'uses',
		hasPlan: false,
		verification: 'verified'
	},
	{
		id: 'app.layout.operations',
		title: 'OperationsLayout',
		category: 'layouts',
		direction: 'used-by',
		hasPlan: false,
		verification: 'verified'
	},
	{
		id: 'app.component.order-list',
		title: 'OrderList',
		category: 'components',
		direction: 'uses',
		hasPlan: false,
		verification: 'verified'
	}
];
const history: HistoryEvent[] = [
	{
		id: 'orders-status-filter',
		at: '2026-10-12T16:20:00Z',
		kind: 'commit',
		title: 'Add order-status filters',
		detail:
			'Review ready and pending orders together, or filter by fulfillment status without losing the current account.',
		commit: commits.tip,
		version: 'v001'
	},
	{
		id: 'orders-search-review',
		at: '2026-10-10T10:24:00Z',
		kind: 'approval',
		title: 'Approve order search behavior',
		detail:
			'Search ignores letter case and keeps matching orders in their original order. The review includes empty queries and no matches.',
		commit: commits.middle,
		version: 'v001'
	}
];

/** Populated tab examples belong to the same Orders page and selected revision. */
export function desktopEntitySectionFixture(data: DesktopData, variant: string): void {
	if (!['apis', 'history', 'used-in', 'uses'].includes(variant)) return;
	data.workspace.entity = { ...data.entity, relationships, history };
}
