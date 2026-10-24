import { expect, test } from 'vitest';
import { content, words } from './entityRender';
import { record, revision } from './entityFixture';
import { commits, units } from './entityUnits';
import { modelContractFixture } from './entityModelContract';
import { modelContract } from '../src/components/explorer-ui/entity-contract/serviceMethods';
import { measureWorkload } from '../../../test/support/measureWorkload';

const model = modelContractFixture(
	{
		...units[1],
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		dependencies: [],
		owns: { source: ['src/models/orders/Order.ts'], symbols: ['Order'] }
	},
	commits.tip
);
const head = revision(commits.tip, [record(commits.tip)]);
head.registry.units.push(model);

test('model contracts show each real initialization and mutation method with parameter and return tables', async () => {
	const body = content(
		'current',
		{ category: 'models', entity: model.id, tab: 'contract' },
		{ head }
	);
	const projected = await measureWorkload(
		'reports.component.explorer-ui-entity-contract-service-methods',
		'model-crud-order',
		() => modelContract(model)
	);
	expect(projected.methods.map((method) => method.name)).toEqual([
		'create',
		'findBy',
		'find',
		'update',
		'delete',
		'initialize'
	]);
	for (const method of ['initialize', 'create', 'findBy', 'find', 'update', 'delete'])
		expect(body).toContain(`aria-label="${method} method"`);
	const headings = [...body.matchAll(/<h3[^>]*>(.*?)<\/h3>/gs)].map((found) =>
		words(found[1]).trim()
	);
	expect(headings).toEqual([
		'create(input)',
		'findBy(fields)',
		'find(id)',
		'update(id, input)',
		'delete(id)',
		'initialize(adapter)'
	]);
	const displayed = words(body).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
	for (const type of ['PersistenceAdapter', 'OrderInput', 'Promise<Order>'])
		expect(displayed).toContain(type);
	for (const title of ['Inputs', 'Outputs', 'Errors'])
		expect(body).not.toContain(`aria-label="${title}"`);
	expect(body).toContain('aria-label="Parameters"');
	expect(body).toContain('aria-label="Returns"');
	expect(body).not.toContain('No errors declared.');
});

test('model details provide a separate revision-scoped Table tab', () => {
	const body = content('current', { category: 'models', entity: model.id, tab: 'table' } as never, {
		head
	});
	expect(body).toContain('>Table<');
	for (const value of ['orders', 'account_id', 'TEXT', 'Primary key', 'Nullable'])
		expect(words(body)).toContain(value);
	expect(body).not.toContain('aria-label="initialize method"');
});

test('model fields keep their declaration heading apart from callable methods', () => {
	const shaped = {
		...model,
		modelDefinitions: model.modelDefinitions!.map((item) => ({
			...item,
			fields: [{ name: 'id', type: 'string', optional: false }]
		}))
	};
	const detail = {
		...head,
		registry: {
			...head.registry,
			units: head.registry.units.map((unit) => (unit.id === model.id ? shaped : unit))
		}
	};
	const body = content(
		'current',
		{ category: 'models', entity: model.id, tab: 'contract' },
		{ head: detail }
	);
	expect(words(body)).toContain('class Order');
	expect(words(body)).not.toContain('Order(id)');
	expect(body).toContain('aria-label="Fields"');
});
