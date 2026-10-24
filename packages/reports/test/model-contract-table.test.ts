import { expect, test } from 'vitest';
import { content, words } from './entityRender';
import { record, revision } from './entityFixture';
import { commits, units } from './entityUnits';
import { modelContractFixture } from './entityModelContract';

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

test('model contracts show each real initialization and mutation method with parameter and return tables', () => {
	const body = content(
		'current',
		{ category: 'models', entity: model.id, tab: 'contract' },
		{ head }
	);
	for (const method of ['initialize', 'create', 'update'])
		expect(body).toContain(`aria-label="${method} method"`);
	expect(words(body)).toContain('initialize(adapter: PersistenceAdapter)');
	expect(words(body)).toContain('create(input: OrderInput)');
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
