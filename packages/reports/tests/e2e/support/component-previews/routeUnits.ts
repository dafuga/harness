import type { HarnessUnit } from '../../../../src/models/Harness.types';
import { ids, units } from '../../../../test/entityUnits';
/** The two kinds the orders history has no unit of, so Shells and Models each open one. */
export const routeIds = { shell: 'app.shell.orders-frame', model: 'app.model.order' };
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
		...owned('src/shells/OrdersFrame.svelte', 'OrdersFrame'),
		id: routeIds.shell,
		kind: 'shell',
		title: 'OrdersFrame',
		responsibility: 'Synthetic preview shell: frames the screens of the orders fixture.',
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
		title: 'Order',
		responsibility: 'Synthetic preview model: the shape of one order of the orders fixture.',
		contract: {
			inputs: [],
			outputs: [
				{ name: 'Order.id', type: 'string' },
				{ name: 'Order.status', type: "'ready' | 'pending'" }
			],
			errors: []
		},
		version: `v-${routeIds.model}`
	}
];
