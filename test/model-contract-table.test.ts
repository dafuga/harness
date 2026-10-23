import { expect, test } from 'vitest';
import { unitMetadata } from '../src/services/revision-detail-service/unitMetadata';
import { revisionRegistry } from '../src/utils/revision-registry/revisionRegistry';
import { indexFiles, memoryTree } from './support/memoryTree';

const path = 'src/models/orders/Order.ts';
const source = `export class Order {
 static readonly definition = {
  table: 'orders', primaryKey: 'id', fields: {
   id: { type: 'number' },
   title: { type: 'string', column: 'order_title' },
   metadata: { type: 'json', nullable: true },
   createdAt: { type: 'string', default: 'timestamp' }
  }
 } as const;
 static initialize(adapter: Adapter): Promise<void> { return adapter.initialize(); }
 static create(adapter: Adapter, input: OrderInput): Promise<OrderRow> {
  return adapter.create(this.definition.table, input);
 }
 static update(adapter: Adapter, id: number, input: OrderInput): Promise<OrderRow | null> {
  return adapter.update(this.definition.table, id, input);
 }
 private static secret() { return 'private'; }
}
export const INTERNAL_LIMIT = 7;`;

const expectedDefinition = [
	{
		name: 'Order',
		kind: 'class',
		source: path,
		fields: [],
		methods: [
			{
				name: 'initialize',
				inputs: [{ name: 'adapter', type: 'Adapter' }],
				output: 'Promise<void>'
			},
			{
				name: 'create',
				inputs: [
					{ name: 'adapter', type: 'Adapter' },
					{ name: 'input', type: 'OrderInput' }
				],
				output: 'Promise<OrderRow>'
			},
			{
				name: 'update',
				inputs: [
					{ name: 'adapter', type: 'Adapter' },
					{ name: 'id', type: 'number' },
					{ name: 'input', type: 'OrderInput' }
				],
				output: 'Promise<OrderRow | null>'
			}
		],
		table: {
			name: 'orders',
			primaryKey: 'id',
			columns: [
				{ property: 'id', name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
				{
					property: 'title',
					name: 'order_title',
					type: 'TEXT',
					nullable: false,
					primaryKey: false
				},
				{
					property: 'metadata',
					name: 'metadata',
					type: 'TEXT',
					nullable: true,
					primaryKey: false
				},
				{
					property: 'createdAt',
					name: 'created_at',
					type: 'TEXT',
					nullable: false,
					primaryKey: false,
					default: 'CURRENT_TIMESTAMP'
				}
			]
		}
	}
];

test('model metadata retains declared methods and statically proven table structure', async () => {
	const files = { [path]: source };
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await unitMetadata(memoryTree(files), registry.units);
	const model = registry.units.find((unit) => unit.kind === 'model')!;
	expect(model).toHaveProperty('modelDefinitions', expectedDefinition);
	await unitMetadata(memoryTree({ [path]: source.replace("'orders'", "'archived_orders'") }), [
		model
	]);
	expect(model).toHaveProperty('modelDefinitions.0.table.name', 'archived_orders');
	await unitMetadata(memoryTree({}), [model]);
	expect(model, 'missing historical source cannot retain newer methods or columns').toHaveProperty(
		'modelDefinitions',
		[]
	);
});

test('shared interfaces expose their own members without invented persistence or constant outputs', async () => {
	const file = 'src/models/accounts/Access.types.ts';
	const files = {
		[file]: `export interface Access {
 accountId: string;
 expiresAt?: string | null;
 authorize(resourceId: string): Promise<boolean>;
}
export const TOKEN_LENGTH = 8;`
	};
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await unitMetadata(memoryTree(files), registry.units);
	const model = registry.units.find((unit) => unit.kind === 'model')!;
	expect(model).toHaveProperty('modelDefinitions', [
		{
			name: 'Access',
			kind: 'interface',
			source: file,
			fields: [
				{ name: 'accountId', type: 'string', optional: false },
				{ name: 'expiresAt', type: 'string | null', optional: true }
			],
			methods: [
				{
					name: 'authorize',
					inputs: [{ name: 'resourceId', type: 'string' }],
					output: 'Promise<boolean>'
				}
			]
		}
	]);
});

test('dynamic table declarations stay unresolved and never execute model code', async () => {
	const files = {
		[path]: source.replace("'orders'", "(() => { throw new Error('must not execute'); })()")
	};
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await unitMetadata(memoryTree(files), registry.units);
	const model = registry.units.find((unit) => unit.kind === 'model')!;
	expect(model).toHaveProperty('modelDefinitions.0.tableGap');
	expect(model).not.toHaveProperty('modelDefinitions.0.table');
});
