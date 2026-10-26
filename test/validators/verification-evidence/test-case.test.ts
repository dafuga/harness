import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { ContractCase } from '../../../src/services/verification-evidence/TestContractService';
import { TestCaseValidator } from '../../../src/validators/verification-evidence/TestCaseValidator';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';
import {
	observedDeclaredCases,
	observedAuthoredCases,
	assertExampleAdmissionInputs
} from '../../support/testCaseAdmissionCases';

const validator = new TestCaseValidator();
test('validate each allowed shape and its missing or invalid states', async () => {
	const { unit, helper } = await indexedOwners();
	const item = {
		id: 'rest',
		state: 'rest',
		subject: 'Runner.run',
		test: { file: 'test/rank.test.ts', title: 'rank rest' },
		expected: { kind: 'value' as const, value: 1 }
	};
	const contract = { version: 1, shape: 'service', states: ['rest'], cases: [item] };
	expect(validator.validate(unit, contract).errors).toEqual([]);
	expect(validator.validate(unit, { ...contract, shape: 'smoke' }).valid).toBe(false);
	expect(validator.validate(unit, { ...contract, cases: [] }).valid).toBe(false);
	expect(validator.validate(unit, { ...contract, states: ['missing'] }).errors.join(' ')).toContain(
		'missing state'
	);
	expect(validator.validate(unit, { ...contract, shape: 'component' }).errors.join(' ')).toContain(
		'screenshot matching'
	);
	expect(
		validator.validate(unit, {
			...contract,
			shape: 'component',
			cases: [
				{ ...item, expected: { kind: 'screenshot', file: 'rank.png' }, viewports: ['desktop'] }
			]
		}).valid
	).toBe(true);
	expect(validator.validate(unit, { ...contract, shape: 'api' }).valid).toBe(false);
	expect(
		validator.validate(unit, {
			...contract,
			shape: 'api',
			cases: [{ ...item, expected: { kind: 'json', value: { rank: 1 } } }]
		}).valid
	).toBe(true);
	expect(validator.validate(unit, { ...contract, shape: 'helper' }).errors.join(' ')).toContain(
		'authored Examples'
	);
	const authored = observedAuthoredCases(validator, helper, { ...item, subject: 'rank' });
	const declared = observedDeclaredCases(validator, unit, helper, item);
	assertExampleAdmissionInputs(validator, helper, item);
	expect(
		[...authored, ...declared],
		'helper case expectations must match their authored Example; method/state matrices must be finite'
	).toEqual([false, false, false, false, false, false, false, false, false, false]);
	await assertMeasuredLayoutPageCases(unit, item);
	assertMethodStateCases(unit, item);
	expect(
		validator.validate(unit, {
			...contract,
			cases: [{ ...item, test: { ...item.test, file: '../escape.test.ts' } }]
		}).valid
	).toBe(false);
});

async function indexedOwners() {
	const indexed = await indexFiles({
		'src/utils/rank.ts': 'export function rank(value: number): number { return value; }',
		'src/services/runner.ts': 'export class Runner { run(value: number): number { return value; } }'
	});
	return { unit: unitOf(indexed, 'service.runner'), helper: unitOf(indexed, 'function.rank') };
}

function assertMethodStateCases(unit: ComponentManifest, item: ContractCase) {
	const owner = { ...unit, owns: { ...unit.owns, symbols: ['Runner.run', 'Runner.close'] } };
	const cases = ['Runner.run', 'Runner.close'].flatMap((subject) =>
		['ready', 'closed'].map((state) => ({
			...item,
			id: subject.toLowerCase() + '.' + state,
			subject,
			state,
			test: { ...item.test, title: subject + ' ' + state }
		}))
	);
	const contract = { version: 1, shape: 'service', states: ['ready', 'closed'], cases };
	expect(validator.validate(owner, contract).errors).toEqual([]);
	expect(
		validator
			.validate(owner, { ...contract, cases: [...cases, { ...cases[0], id: 'bug-only' }] })
			.errors.join(' ')
	).toContain('exactly one method/state');
	expect(
		validator
			.validate(owner, {
				...contract,
				cases: [...cases, { ...cases[0], id: 'orphan', subject: 'Runner.unknown' }]
			})
			.errors.join(' ')
	).toContain('unknown method');
	expect(
		validator.validate(owner, { ...contract, cases: cases.slice(1) }).errors.join(' ')
	).toContain('missing method/state');
}

function assertLayoutPageCases(unit: ComponentManifest, item: ContractCase) {
	const layout = { ...unit, kind: 'layout' };
	const page = {
		version: 1,
		shape: 'page',
		states: ['rest'],
		cases: [
			{
				...item,
				fixture: 'src/routes/blog-post/__harness/+page.svelte',
				expected: { kind: 'screenshot' as const, file: 'layout.png' },
				viewports: ['desktop', 'tablet', 'mobile']
			}
		]
	};
	const observed = ['page', 'component', 'layout'].map(
		(shape) => validator.validate(layout, { ...page, shape }).valid
	);
	expect(observed, 'Layouts use the existing page form').toEqual([true, false, false]);
	assertPageViewportCoverage(unit, page);
}

function assertPageViewportCoverage(
	unit: ComponentManifest,
	page: { version: number; shape: string; states: string[]; cases: ContractCase[] }
) {
	const base = page.cases[0];
	const error = { ...base, id: 'error', state: 'error', test: { ...base.test, title: 'error' } };
	const matrix = { ...page, states: ['rest', 'error'], cases: [base, error] };
	for (const kind of ['page', 'layout'] as const) {
		const owner = { ...unit, kind };
		expect(validator.validate(owner, matrix).errors).toEqual([]);
		for (const state of matrix.states) {
			const cases = matrix.cases.map((item) =>
				item.state === state ? { ...item, viewports: ['desktop', 'tablet'] } : item
			);
			expect(
				validator.validate(owner, { ...matrix, cases }).errors.join(' '),
				`${kind} ${state} requires mobile`
			).toContain('missing viewport mobile');
		}
		const alternate = {
			...base,
			id: 'alternate',
			input: { disabled: true },
			props: ['disabled'],
			viewports: ['desktop'],
			test: { ...base.test, title: 'alternate' }
		};
		expect(
			validator
				.validate(owner, { ...page, props: ['disabled'], cases: [base, alternate] })
				.errors.join(' '),
			`${kind} each distinct prop row requires every viewport`
		).toContain('missing viewport tablet');
		const split = ['desktop', 'tablet', 'mobile'].map((viewport) => ({
			...base,
			id: `rest.${viewport}`,
			viewports: [viewport],
			test: { ...base.test, title: viewport }
		}));
		expect(validator.validate(owner, { ...page, cases: split }).errors).toEqual([]);
	}
}

async function assertMeasuredLayoutPageCases(unit: ComponentManifest, item: ContractCase) {
	await measureWorkload(
		'validator.verification-evidence-test-case',
		'layout-page-case-admission',
		() => assertLayoutPageCases(unit, item)
	);
}
