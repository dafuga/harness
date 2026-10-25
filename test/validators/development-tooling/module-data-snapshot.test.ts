import { expect, test } from 'vitest';
import { ModuleDataSnapshotValidator } from '../../../src/validators/development-tooling/ModuleDataSnapshotValidator';
const unit = { id: 'page.orders', kind: 'page', status: 'active' };
const empty = {
	pages: [],
	layouts: [],
	components: [],
	functions: [],
	configs: [],
	services: [],
	types: [],
	apis: [],
	models: [],
	usedBy: [],
	support: []
};
const complete = () => ({
	declarations: [unit],
	registry: { units: [unit] },
	modules: [{ id: unit.id, kind: unit.kind, issues: [] }],
	issues: [],
	relationships: { [unit.id]: { ...empty } }
});
test('snapshot validation requires module coverage and all explicit relationship collections', () => {
	const validator = new ModuleDataSnapshotValidator();
	expect(validator.validate(complete()).valid).toBe(true);
	const missing = { ...complete(), modules: [] };
	expect(validator.validate(missing)).toMatchObject({
		valid: false,
		errors: expect.arrayContaining(['page.orders: missing validation report.'])
	});
	expect(validator.validate({ ...complete(), relationships: {} }).valid).toBe(false);
	expect(
		validator.validate({
			...complete(),
			relationships: { [unit.id]: { ...empty, apis: ['endpoint.unknown'] } }
		}).valid
	).toBe(false);
	expect(
		validator.validate({ ...complete(), modules: [...complete().modules, ...complete().modules] })
			.valid
	).toBe(false);
	expect(validator.validate({}).valid).toBe(false);
});

test('legacy source reuse rejects snapshots that indexed planning data as modules', () => {
	const validator = new ModuleDataSnapshotValidator();
	const held = (producer: string, path: string) => ({
		producer,
		declarations: [{ owns: { source: [path] } }]
	});
	const legacy = 'harness-module-data-v1.2026-10-25.5';
	expect(validator.sourceProducer(held(legacy, 'src/components/Item.svelte'))).toBe(true);
	for (const extension of ['ndjson', 'jsonl'])
		expect(
			validator.sourceProducer(held(legacy, `src/components/item/messages.${extension}`))
		).toBe(false);
	expect(
		validator.sourceProducer(held('unrecognized-producer', 'src/components/Item.svelte'))
	).toBe(false);
});
