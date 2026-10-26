import { expect, test } from 'vitest';
import {
	unit,
	relationships,
	data,
	change,
	plan,
	assertScopedUncertainty
} from './feature-plan-coverage.test.fixtures';
import { FeaturePlanCoverageValidator } from '../../../src/validators/agents-providers/FeaturePlanCoverageValidator';

test('FeaturePlanCoverageValidator.validate from default initialization covers supported and invalid inputs', () => {
	for (const input of [{ title: 'value' }, {}, null, undefined]) {
		const result = validate(input);
		expect(result).toEqual({
			valid: false,
			affectedPages: [],
			missingPages: [],
			errors: expect.any(Array)
		});
		expect(result.errors.length).toBeGreaterThan(0);
	}
	const missingMetadata = validate(plan());
	expect(missingMetadata.valid).toBe(false);
	expect(missingMetadata.errors.length).toBeGreaterThan(0);
	const metadata = data();
	metadata.commit = 'f'.repeat(40);
	expect(validate(plan([change('page.direct')], ['page.direct']), metadata).valid).toBe(false);
	const cycle = plan(
		[
			change('page.direct', 'modify', 'component.shared'),
			change('component.shared', 'modify', 'page.direct')
		],
		['page.direct']
	);
	const blocked = validate(cycle, data());
	expect(blocked.valid).toBe(false);
	expect(blocked.affectedPages).toEqual(['page.direct']);
	expect(blocked.errors.join(' ')).toMatch(/cyclic/i);
});

function validate(input: unknown, metadata?: unknown) {
	const validator = new FeaturePlanCoverageValidator();
	const result = validator.validate(input as never, metadata as never);
	const candidate = input as ReturnType<typeof plan> | null | undefined;
	const impact = candidate && { sourceCommit: candidate.sourceCommit, changes: candidate.changes };
	const discovery = validator.discover(impact as never, metadata as never);
	if (!candidate?.sourceCommit || !Array.isArray(candidate.changes)) {
		expect(discovery).toEqual({ valid: false, affectedPages: [], errors: expect.any(Array) });
		expect(discovery.errors.length).toBeGreaterThan(0);
		return result;
	}
	const blockers = result.errors.filter(
		(error) => !result.missingPages.some((page) => error === `Missing page design: ${page}`)
	);
	expect(discovery).toEqual({
		valid: blockers.length === 0,
		affectedPages: result.affectedPages,
		errors: blockers
	});
	return result;
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
	for (const references of [
		[],
		[
			{
				node: 'test/unrelated.test.ts',
				reason: 'dynamic-import',
				detail: 'Unrelated test fixture import'
			}
		]
	]) {
		metadata.references = references;
		for (const changes of [[], [change('component.shared', 'reuse')]]) {
			const input = plan(changes);
			const before = structuredClone({ input, metadata });
			expect(validate(input, metadata)).toEqual({
				valid: true,
				affectedPages: [],
				missingPages: [],
				errors: []
			});
			expect({ input, metadata }).toEqual(before);
		}
	}
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
	assertScopedUncertainty();
	const metadata = data();
	const references = [
		{ node: 'src/component.shared.ts', reason: 'unresolved', detail: './dynamic-shared' },
		{ node: 'src/component.other.ts', reason: 'dynamic-import', detail: './dynamic-other' }
	];
	metadata.references = references;
	const input = plan([change('component.shared'), change('component.other')]);
	const before = structuredClone({ input, metadata });
	const result = validate(input, metadata);
	expect(result.valid).toBe(false);
	expect(result.errors.join('\n')).toMatch(/unresolved|uncertain/i);
	for (const reference of references) {
		expect(
			result.errors.some((error) =>
				Object.values(reference).every((field) => error.includes(field))
			)
		).toBe(true);
	}
	expect({ input, metadata }).toEqual(before);
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
