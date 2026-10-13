/**
 * The manifests of a project in which one identity is a rendered page at an earlier commit and
 * only a loader at the tip. What a manifest owns at a commit is all that says which it is there:
 * an ordinary page has the title of that loader, and the twin has its sentence as well.
 */
export type Listing = [id: string, title: string, responsibility: string, source: string[]];

export const former =
	'Redirects the former analytics address to the explorer; the console has no analytics page.';
export const charted = 'Charts every run of the project by day.';
export const analytics = 'reports.page.analytics';

/** The identity at the earlier commit: a page file beside its loader, so it renders an address. */
export const rendered: Listing = [
	analytics,
	'/analytics',
	charted,
	['src/routes/analytics/+page.server.ts', 'src/routes/analytics/+page.svelte']
];

/** What only loads for an address at the tip: every file each one owns is a page loader. */
export const loaders: Listing[] = [
	[analytics, '/analytics', former, ['src/routes/analytics/+page.server.ts']],
	[
		'reports.page.reports-id',
		'/reports/[id]',
		'Redirects a former report address to the console.',
		['src/routes/reports/[id]/+page.server.ts']
	],
	[
		'reports.page.harness-reports',
		'/harness/reports',
		'Redirects the former report hub address to the explorer; the console has no report hub.',
		['src/routes/harness/reports/+page.server.ts']
	],
	[
		'reports.page.root',
		'/',
		'Redirects the root of this server to the explorer.',
		['src/routes/+page.ts']
	]
];

/** What is what it says at both commits: a page beside a loader, two pages no route file names. */
export const ordinary: Listing[] = [
	[
		'insights.page.analytics',
		'/analytics',
		'Charts how many runs passed each day.',
		['src/routes/insights/analytics/+page.svelte']
	],
	[
		'page.reports',
		'Reports',
		'Lists the reports a team wrote.',
		['src/routes/reports/+page.server.ts', 'src/routes/reports/+page.svelte']
	],
	[
		'page.report-redirects',
		'Report redirects',
		'Lists where each report address leads.',
		['src/pages/ReportRedirects.ts']
	],
	[
		'page.orders-error',
		'/orders/error',
		'Says that an order could not be shown.',
		['src/routes/orders/+error.svelte']
	],
	[
		'service.analytics',
		'Analytics',
		'Counts the runs the analytics page charts.',
		['src/services/Analytics.ts']
	]
];

/** A rendered page with the title and the very sentence of the loader that is left out. */
export const twin: Listing = [
	'insights.page.former',
	'/analytics',
	former,
	['src/routes/insights/former/+page.svelte']
];

export const idsOf = (listings: Listing[]) => listings.map(([id]) => id).sort();

/** The manifest of one of them as a registry holds it; its kind is the one its identity names. */
export function manifest([id, title, responsibility, source]: Listing) {
	const kind = id.split('.').at(-2) as string;
	const entry = source[0];
	return {
		schemaVersion: 1,
		id,
		kind,
		title,
		responsibility,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source, symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}
