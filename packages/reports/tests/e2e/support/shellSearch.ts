import type { ExplorerScope } from '../../../src/models/Explorer.types';
import { sha } from './shellData';

/**
 * What each revision of the made-up history holds to search, as a host hands it to the bar: the
 * newer commits of the branch hold a shell and a totals function, the older ones a legacy one.
 */
type Row = [id: string, category: string, name: string, purpose: string, terms?: string[]];
const lasting: Row[] = [
	['app.page.orders', 'pages', 'Orders', 'Lists every order of a customer.'],
	['app.component.order-list', 'components', 'Order list', 'Shows orders in a table.'],
	['app.config.order-limits', 'configs', 'Order limits', 'How many orders a page lists.'],
	[
		'app.service.order-refunds',
		'services',
		'Order refunds',
		'Pays back a refunded order.',
		['amountInCents']
	]
];
const newer: Row[] = [
	['app.shell.order-frame', 'shells', 'Order frame', 'Frames the order pages.'],
	[
		'app.function.order-totals',
		'functions',
		'Order totals',
		'Adds up the orders of a day.',
		['day']
	]
];
const older: Row[] = [
	['app.function.legacy-totals', 'functions', 'Legacy totals', 'Sums orders the old way.']
];

export function shellSearchEntries(scope: ExplorerScope) {
	const rows = [...lasting, ...([sha(5), sha(4)].includes(scope.commit) ? newer : older)];
	return rows.map(([id, category, name, purpose, terms = []]) => ({
		...{ id, category, name, purpose, terms },
		commit: scope.commit
	}));
}
