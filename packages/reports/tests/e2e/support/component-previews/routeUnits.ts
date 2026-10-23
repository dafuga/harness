import { modelDefinition } from '../../../../test/entityClassFixtures';
import type { HarnessUnit } from '../../../../src/models/Harness.types';
import { ids, units } from '../../../../test/entityUnits';
/** Additional synthetic declarations opened by the Layouts, Models and Types routes. */
export const routeIds = {
	shell: 'app.shell.orders-frame',
	model: 'app.model.order',
	types: 'app.model.order-input'
};
const card = units.find((unit) => unit.id === ids.card)!;
const settings = units.find((unit) => unit.id === ids.settings)!;
const owned = (file: string, symbol: string) => ({
	owns: { source: [file], symbols: [symbol] },
	runtime: { kind: 'module', targets: [{ kind: 'module', entry: file }] }
});
/**
 * SYNTHETIC units, said to be so in their responsibility: no source file of any project stands
 * behind them. Neither uses another unit, so nothing else the history shows changes for them.
 */
export const routeUnits: HarnessUnit[] = [
	{
		...card,
		...owned('src/layouts/OrdersFrame.svelte', 'OrdersFrame'),
		id: routeIds.shell,
		kind: 'layout',
		title: 'OrdersFrame',
		responsibility: 'Synthetic preview layout: frames the screens of the orders fixture.',
		contract: {
			inputs: [{ name: 'OrdersFrame.children', type: 'Snippet' }],
			outputs: [{ name: 'OrdersFrame.markup', type: 'markup' }],
			errors: []
		},
		version: `v-${routeIds.shell}`
	},
	{
		...settings,
		...owned('src/models/Order.ts', 'Order'),
		id: routeIds.model,
		kind: 'model',
		modelDefinitions: [modelDefinition('Order', 'src/models/Order.ts')],
		title: 'Order',
		responsibility: 'Synthetic preview model: wraps stored order data in the orders fixture.',
		contract: {
			inputs: [],
			outputs: [
				{ name: 'Order.id', type: 'string' },
				{ name: 'Order.status', type: "'ready' | 'pending'" }
			],
			errors: []
		},
		version: `v-${routeIds.model}`
	},
	{
		...settings,
		...owned('src/models/OrderInput.types.ts', 'OrderInput'),
		id: routeIds.types,
		kind: 'model',
		title: 'OrderInput.types',
		responsibility: 'Synthetic shared type module: describes order input data.',
		modelDefinitions: [modelDefinition('OrderInput', 'src/models/OrderInput.types.ts')],
		contract: { inputs: [], outputs: [], errors: [] },
		version: `v-${routeIds.types}`
	}
];
