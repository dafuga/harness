import type { UnitSeed, CaptureSeed } from './entityUnits.types';
import { serviceMetadata } from './entityClassFixtures';
import type { HarnessCapture, HarnessScenario, HarnessUnit } from '../src/models/Harness.types';

/** Synthetic history of an invented orders application; nothing here is a real repository. */
export const sha = (letter: string): string => letter.repeat(40);
export const commits = { first: sha('a'), middle: sha('b'), tip: sha('c') };
export const ids = {
	page: 'app.page.orders',
	list: 'app.component.order-list',
	card: 'app.component.order-card',
	search: 'app.component.search-box',
	filter: 'app.function.filter-orders',
	settings: 'app.config.order-settings',
	store: 'app.service.order-store'
};

function unit(seed: UnitSeed): HarnessUnit {
	// A page is what renders an address: it owns the route file of that address.
	const file =
		seed.kind === 'page' ? 'src/routes/orders/+page.svelte' : `src/${seed.kind}s/${seed.title}.ts`;
	const named = (names: string[] = []) =>
		names.map((name) => ({
			name: `${seed.title}.${name}`,
			type: 'string',
			...(name === 'searchText' ? { examples: ['SERVICE'] } : {})
		}));
	return {
		id: seed.id,
		kind: seed.kind,
		status: 'active',
		title: seed.title,
		responsibility: seed.responsibility,
		dependencies: (seed.uses ?? []).map((target) => ({ unit: target, via: 'import' })),
		scenarios: [],
		owns: {
			source: [file],
			symbols:
				seed.kind === 'service'
					? [`${seed.title}Options`, seed.title, `${seed.title}Result`]
					: [seed.title]
		},
		contract: { inputs: named(seed.inputs), outputs: named(seed.outputs), errors: [] },
		...(seed.kind === 'function'
			? {
					helpers: [
						{
							name: seed.title,
							pure: true,
							source: file,
							inputs: named(seed.inputs),
							consumers: [{ unit: ids.list }, { unit: ids.store }]
						}
					]
				}
			: {}),
		...(seed.kind === 'service'
			? serviceMetadata([{ unit: ids.list }, { unit: ids.search }], seed.title, file)
			: {}),
		runtime: {
			kind: 'module',
			targets: (seed.targets ?? ['module']).map((kind) => ({ kind, entry: file }))
		},
		budgets: { size: 'frozen', complexity: 'frozen', performance: seed.performance ?? [] },
		version: `v-${seed.id}`
	};
}

export const units: HarnessUnit[] = [
	unit({
		id: ids.page,
		kind: 'page',
		title: 'OrdersPage',
		responsibility: 'Lists the orders of an account.',
		uses: [ids.list, ids.search, ids.settings],
		inputs: ['accountId', 'searchText'],
		outputs: ['markup']
	}),
	unit({
		id: ids.list,
		kind: 'component',
		title: 'OrderList',
		responsibility: 'Arranges orders into a searchable list.',
		uses: [ids.card, ids.filter, ids.store],
		inputs: ['orders', 'searchText'],
		outputs: ['markup']
	}),
	unit({
		id: ids.card,
		kind: 'component',
		title: 'OrderCard',
		responsibility: 'Shows one order.',
		inputs: ['order'],
		outputs: ['markup']
	}),
	unit({
		id: ids.search,
		kind: 'component',
		title: 'SearchBox',
		responsibility: 'Takes the text orders are searched by.',
		uses: [ids.store],
		inputs: ['value'],
		outputs: ['markup']
	}),
	unit({
		id: ids.filter,
		kind: 'function',
		title: 'filterOrders',
		responsibility: 'Returns the orders whose name matches a search.',
		inputs: ['orders', 'searchText'],
		outputs: ['matchingOrders'],
		performance: [{ workload: 'thousand-orders', metric: 'p95-ms', tolerance: 0.05 }]
	}),
	unit({
		id: ids.settings,
		kind: 'config',
		title: 'orderSettings',
		responsibility: 'Defines how many orders a page shows.',
		outputs: ['pageSize', 'defaultSort']
	}),
	unit({
		id: ids.store,
		kind: 'service',
		title: 'OrderStore',
		responsibility: 'Reads the orders of one account.',
		inputs: ['accountId'],
		outputs: ['orders'],
		targets: ['module', 'wasm', 'process']
	})
];

export const scenarios: HarnessScenario[] = [
	{
		id: 'orders-page',
		title: 'Orders page over synthetic orders',
		kind: 'ui',
		units: [ids.page, ids.list, ids.card, ids.search],
		states: [
			{ id: 'default', coverage: 'required' },
			{ id: 'empty', coverage: 'required' },
			{ id: 'denied', coverage: 'inapplicable', reason: 'the orders page has no sign-in' }
		],
		viewports: [
			{ id: 'desktop', width: 1440, height: 900 },
			{ id: 'mobile', width: 390, height: 844 }
		],
		tests: [{ id: 'orders-browser', kind: 'e2e', runner: 'playwright' }],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['default', 'empty'],
				viewports: ['desktop', 'mobile']
			}
		]
	},
	{
		id: 'order-filter',
		title: 'Search across synthetic orders',
		kind: 'headless',
		units: [ids.filter, ids.store],
		states: [
			{ id: 'match', coverage: 'required' },
			{ id: 'no-match', coverage: 'required' }
		],
		viewports: [],
		tests: [{ id: 'filter-flow', kind: 'e2e', runner: 'vitest' }],
		evidence: [
			{ id: 'assertions', kind: 'assertions', states: ['match', 'no-match'], viewports: [] },
			{ id: 'output', kind: 'output', states: ['match'], viewports: [] }
		]
	}
];

const files: Record<string, [string, string]> = {
	screenshot: ['png', 'image/png'],
	audio: ['wav', 'audio/wav']
};

export function capture(commit: string, seed: CaptureSeed): HarnessCapture {
	const [extension, mediaType] = files[seed.kind] ?? ['json', 'application/json'];
	const name = [commit.slice(0, 7), seed.state, seed.viewport ?? seed.kind].join('-');
	const media = seed.media === undefined ? `media/${name}.${extension}` : seed.media;
	const said = {
		transcript: '[Synthetic 440 Hz tone; no spoken words.]',
		durationSeconds: 2,
		provenance: 'fixture'
	};
	return {
		evidence: seed.kind === 'screenshot' ? 'screens' : seed.kind,
		kind: seed.kind,
		state: seed.state,
		...(seed.viewport ? { viewport: seed.viewport } : {}),
		status: seed.status ?? 'passed',
		path: `records/${name}`,
		sha256: 'f'.repeat(64),
		mediaType,
		capturedAt: '2026-10-09T10:00:00.000Z',
		...(seed.kind === 'screenshot' ? { server: { buildId: 'build-1', revision: commit } } : {}),
		...(seed.kind === 'audio' ? said : {}),
		media,
		...(media === null ? { gap: 'the bytes are not in this history' } : {})
	};
}

export type { CaptureSeed } from './entityUnits.types';
