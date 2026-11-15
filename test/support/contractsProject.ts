import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { componentManifestSchema } from '../../src/core/development-tooling/unitTypes';

export function contractUnit(id: string, source: string, dependencies: string[] = []) {
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id,
		kind: id.split('.')[0],
		title: id,
		responsibility: `Describes ${id}.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: dependencies.map((unit) => ({ unit, via: 'import', origin: 'declared' })),
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	});
}

export async function writeContract(root: string, path: string, data: unknown) {
	const destination = join(root, 'specification/units', path);
	await mkdir(dirname(destination), { recursive: true });
	await writeFile(destination, JSON.stringify(data));
}

export async function contractsProject() {
	const root = await mkdtemp(join(tmpdir(), 'harness-contracts-'));
	const price = contractUnit('service.price', 'src/services/billing/Price.ts', ['model.invoice']);
	price.title = 'PriceService';
	price.responsibility = 'Quotes invoice totals without charging.';
	price.contract.inputs = [{ name: 'amount', type: 'Money', description: 'Subtotal in EUR.' }];
	price.contract.outputs = [{ name: 'quote', type: 'PriceQuote', description: 'Quoted total.' }];
	price.contract.errors = [
		{ name: 'RangeError', type: 'thrown', description: 'Negative subtotal.' }
	];
	price.scenarios = ['price-loading'];
	const invoice = contractUnit('model.invoice', 'src/models/billing/Invoice.ts');
	const checkout = contractUnit('service.checkout', 'src/services/shop/Checkout.ts', [price.id]);
	const sibling = contractUnit('service.prices', 'src/services/billing-extra/Prices.ts');
	const retired = {
		...contractUnit('service.old', 'src/services/billing/Old.ts'),
		status: 'retired'
	};
	await writeContract(root, '../scenarios/price-flow.json', {
		schemaVersion: 1,
		id: 'price-loading',
		title: 'Quote flow',
		kind: 'headless',
		units: [price.id],
		states: [{ id: 'quote-pending', title: 'Waiting for currency', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'quote', kind: 'unit', runner: 'vitest', target: 'test/quote.test.ts' }],
		evidence: []
	});
	await writeContract(root, 'nested/price.json', price);
	for (const unit of [invoice, checkout, sibling, retired])
		await writeContract(root, `${unit.id}.json`, unit);
	// Source is deliberately invalid: contract commands must never parse or search it.
	await mkdir(join(root, 'src/services/billing'), { recursive: true });
	await writeFile(join(root, price.owns.source[0]), 'SOURCE_ONLY_SECRET invalid TypeScript {{');
	return { root, price, invoice, checkout, sibling };
}
