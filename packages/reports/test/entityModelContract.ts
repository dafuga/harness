import type { HarnessUnit } from '../src/models/Harness.types';

/** Synthetic model declarations let normal model detail coverage distinguish methods and storage. */
export function modelContractFixture(unit: HarnessUnit, commit: string): HarnessUnit {
	if (unit.id !== 'app.model.order') return unit;
	const previous = commit === 'b'.repeat(40);
	const declaration = {
		name: 'Order',
		kind: 'class',
		source: 'src/models/orders/Order.ts',
		fields: [],
		methods: [
			{
				name: 'initialize',
				inputs: [{ name: 'adapter', type: 'PersistenceAdapter' }],
				output: 'Promise<void>'
			},
			{ name: 'create', inputs: [{ name: 'input', type: 'OrderInput' }], output: 'Promise<Order>' },
			{
				name: 'update',
				inputs: [
					{ name: 'id', type: 'string' },
					{ name: 'input', type: 'OrderInput' }
				],
				output: 'Promise<Order | null>'
			}
		],
		table: {
			name: previous ? 'purchases' : 'orders',
			primaryKey: 'id',
			columns: [
				{ property: 'id', name: 'id', type: 'TEXT', primaryKey: true, nullable: false },
				{
					property: 'accountId',
					name: 'account_id',
					type: 'TEXT',
					primaryKey: false,
					nullable: false
				},
				{ property: 'metadata', name: 'metadata', type: 'TEXT', primaryKey: false, nullable: true }
			]
		}
	};
	return Object.assign(
		{ ...unit, contract: { inputs: [], outputs: [], errors: [] } },
		{
			modelDefinitions: [declaration]
		}
	);
}
