import { expect, test } from 'vitest';
import { unit, relationships, data, change, plan } from './feature-plan-coverage.test.fixtures';
import { FeaturePlanCoverageValidator } from '../../../src/validators/agents-providers/FeaturePlanCoverageValidator';

test('FeaturePlanCoverageValidator.validate from default initialization covers supported and invalid inputs', () => {
	const validator = new FeaturePlanCoverageValidator();
	// => { valid: true, errors: [] }
	expect(validator.validate({ title: 'value' })).toEqual({ valid: true, errors: [] });
	// => { valid: false, errors: ['input is empty'] }
	expect(validator.validate({})).toEqual({ valid: false, errors: ['input is empty'] });
	// throws TypeError
	expect(() => validator.validate(null as never)).toThrow(TypeError);
});

function validate(input: ReturnType<typeof plan>, metadata: ReturnType<typeof data>) {
	const validator = new FeaturePlanCoverageValidator();
	return (
		validator.validate as unknown as (
			plan: unknown,
			data: unknown
		) => {
			valid: boolean;
			affectedPages: string[];
			missingPages: string[];
			errors: string[];
		}
	)(input, metadata);
}

test('covers direct pages and every consuming page with a deterministic deduplicated union', () => {
	const metadata = data();
	metadata.relationships['component.shared'].pages = ['page.beta', 'page.alpha', 'page.beta'];
	metadata.relationships['component.other'].pages = ['page.alpha'];
	const input = plan(
		[change('component.other'), change('page.direct'), change('component.shared')],
		['page.alpha', 'page.beta', 'page.direct']
	);
	const before = JSON.stringify({ input, metadata });
	expect(validate(input, metadata)).toEqual({
		valid: true,
		affectedPages: ['page.alpha', 'page.beta', 'page.direct'],
		missingPages: [],
		errors: []
	});
	expect(JSON.stringify({ input, metadata })).toBe(before);
	expect(validate({ ...input, changes: [...input.changes].reverse() }, metadata)).toEqual(
		validate(input, metadata)
	);
});

test('reports each missing consuming page and directly changed page', () => {
	const metadata = data();
	metadata.relationships['component.shared'].pages = ['page.beta', 'page.alpha'];
	const result = validate(plan([change('component.shared'), change('page.direct')]), metadata);
	expect(result.valid).toBe(false);
	expect(result.missingPages).toEqual(['page.alpha', 'page.beta', 'page.direct']);
	for (const page of result.missingPages) expect(result.errors.join('\n')).toContain(page);
});

test('includes a registered planned page ancestor through intermediate planned modules', () => {
	const metadata = data();
	for (const item of [
		unit('page.new', 'page'),
		unit('component.parent'),
		unit('component.child')
	]) {
		metadata.registry.units.push(item);
		metadata.relationships[item.id] = relationships();
	}
	const page = change('page.new', 'reuse');
	page.assignedFiles = ['src/routes/new/+page.svelte'];
	const changes = [
		page,
		change('component.parent', 'add', 'page.new'),
		change('component.child', 'add', 'component.parent')
	];
	const missing = validate(plan(changes), metadata);
	expect(missing.valid).toBe(false);
	expect(missing.affectedPages).toEqual(['page.new']);
	expect(missing.missingPages).toEqual(['page.new']);
	expect(validate(plan(changes, ['page.new']), metadata)).toEqual({
		valid: true,
		affectedPages: ['page.new'],
		missingPages: [],
		errors: []
	});
});

test('reuse alone does not introduce consuming-page coverage obligations', () => {
	const metadata = data();
	metadata.relationships['component.shared'].pages = ['page.alpha'];
	expect(validate(plan([change('component.shared', 'reuse')]), metadata)).toEqual({
		valid: true,
		affectedPages: [],
		missingPages: [],
		errors: []
	});
});

test('removed components still require all their consuming page designs', () => {
	const metadata = data();
	metadata.relationships['component.shared'].pages = ['page.alpha'];
	const result = validate(plan([change('component.shared', 'remove')]), metadata);
	expect(result.valid).toBe(false);
	expect(result.missingPages).toEqual(['page.alpha']);
});

test('reports every unknown or inactive changed module', () => {
	const metadata = data();
	metadata.registry.units.push(unit('component.inactive', 'component', 'inactive'));
	metadata.relationships['component.inactive'] = relationships();
	const result = validate(
		plan([change('component.missing'), change('component.inactive')]),
		metadata
	);
	expect(result.valid).toBe(false);
	for (const id of ['component.missing', 'component.inactive'])
		expect(result.errors.join('\n')).toContain(id);
});

test('missing relationship metadata fails closed instead of silently reporting no pages', () => {
	const metadata = data();
	delete metadata.relationships['component.shared'];
	const result = validate(plan(), metadata);
	expect(result.valid).toBe(false);
	expect(result.errors.join('\n')).toMatch(/relationship/i);
	expect(result.errors.join('\n')).toContain('component.shared');
});

test('unresolved committed graph references reject even otherwise complete designs', () => {
	const metadata = data();
	metadata.references = [
		{ from: 'src/component.shared.ts', specifier: './dynamic', reason: 'unresolved' }
	];
	const result = validate(plan(), metadata);
	expect(result.valid).toBe(false);
	expect(result.errors.join('\n')).toMatch(/unresolved|uncertain/i);
});

test('unregistered added pages and children fail closed until metadata is committed', () => {
	const page = change('page.new', 'add');
	page.assignedFiles = ['src/routes/new/+page.svelte'];
	const result = validate(
		plan([page, change('component.new', 'add', 'page.new')], ['page.new']),
		data()
	);
	expect(result.valid).toBe(false);
	for (const id of ['page.new', 'component.new']) expect(result.errors.join('\n')).toContain(id);
});
