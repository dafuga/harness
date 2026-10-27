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
import {
	methodLifecycleDiagnostics,
	syntheticMethodLifecycleFixture
} from './test-case.test.fixtures';

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
	assertMethodSpecificLifecycleCases(unit, item);
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

function assertMethodSpecificLifecycleCases(unit: ComponentManifest, item: ContractCase) {
	const { owner, contract } = syntheticMethodLifecycleFixture(unit, item);
	const validate = (input: unknown) =>
		validator.validate(owner, input as Parameters<typeof validator.validate>[1]);

	const complete = validate(contract);
	expect(complete.valid, 'method-specific lifecycle states need no global states').toBe(true);
	expect(complete.errors).toEqual([]);
	expect(contract).not.toHaveProperty('states');

	const missingPair = validate({
		...contract,
		cases: contract.cases.filter(
			(caseItem) => !(caseItem.subject === 'Synthetic.run' && caseItem.state === 'cancelled')
		)
	});
	expect(missingPair.valid).toBe(false);
	expect(missingPair.errors).toContain(methodLifecycleDiagnostics.missingPair);

	const undeclaredPair = validate({
		...contract,
		cases: [
			...contract.cases,
			{
				...contract.cases[0],
				id: 'Synthetic.ready.cancelled',
				state: 'cancelled',
				subject: 'Synthetic.ready',
				test: { ...contract.cases[0].test, title: 'Synthetic.ready cancelled' }
			}
		]
	});
	expect(undeclaredPair.valid).toBe(false);
	expect(undeclaredPair.errors).toContain(methodLifecycleDiagnostics.undeclaredPair);

	const missingMethodDeclaration = validate({
		...contract,
		methodStates: { 'Synthetic.ready': ['qualified', 'unconfigured'] }
	});
	expect(missingMethodDeclaration.valid).toBe(false);
	expect(missingMethodDeclaration.errors).toContain(methodLifecycleDiagnostics.missingMethod);

	const unknownMethod = validate({
		...contract,
		methodStates: {
			...contract.methodStates,
			'Synthetic.unknown': ['qualified']
		}
	});
	expect(unknownMethod.valid).toBe(false);
	expect(unknownMethod.errors).toContain(methodLifecycleDiagnostics.unknownMethod);

	const constructorMethod = validate({
		...contract,
		methodStates: {
			...contract.methodStates,
			'Synthetic.constructor': ['qualified']
		}
	});
	expect(constructorMethod.valid).toBe(false);
	expect(constructorMethod.errors).toContain(methodLifecycleDiagnostics.constructorMethod);

	const emptyMap = validate({ ...contract, methodStates: {} });
	expect(emptyMap.valid).toBe(false);
	expect(emptyMap.errors).toContain(methodLifecycleDiagnostics.emptyMap);

	const emptyList = validate({
		...contract,
		methodStates: { ...contract.methodStates, 'Synthetic.ready': [] }
	});
	expect(emptyList.valid).toBe(false);
	expect(emptyList.errors).toContain(methodLifecycleDiagnostics.emptyList);

	const duplicateStates = validate({
		...contract,
		methodStates: {
			...contract.methodStates,
			'Synthetic.ready': ['qualified', 'qualified']
		}
	});
	expect(duplicateStates.valid).toBe(false);
	expect(duplicateStates.errors).toContain(methodLifecycleDiagnostics.duplicateStates);

	const invalidState = validate({
		...contract,
		methodStates: { ...contract.methodStates, 'Synthetic.ready': ['not a state'] }
	});
	expect(invalidState.valid).toBe(false);
	expect(invalidState.errors).toContain(methodLifecycleDiagnostics.invalidState);

	const nonServiceShape = validate({ ...contract, shape: 'component' });
	expect(nonServiceShape.valid).toBe(false);
	expect(nonServiceShape.errors).toContain(methodLifecycleDiagnostics.unsupportedShape);

	const ambiguousGlobalStates = validate({
		...contract,
		states: ['qualified', 'unconfigured', 'cancelled']
	});
	expect(ambiguousGlobalStates.valid).toBe(false);
	expect(ambiguousGlobalStates.errors).toContain(methodLifecycleDiagnostics.ambiguousGlobalStates);

	const duplicateCase = validate({
		...contract,
		cases: [
			...contract.cases,
			{
				...contract.cases[0],
				id: 'Synthetic.ready.qualified.duplicate',
				test: {
					...contract.cases[0].test,
					title: 'Synthetic.ready qualified duplicate'
				}
			}
		]
	});
	expect(duplicateCase.valid).toBe(false);
	expect(duplicateCase.errors.join(' ')).toContain('exactly one method/state');
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
				expected: { kind: 'screenshot', file: 'layout.png' },
				viewports: ['desktop', 'tablet', 'mobile']
			}
		]
	};
	const observed = ['page', 'component', 'layout'].map(
		(shape) => validator.validate(layout, { ...page, shape }).valid
	);
	expect(observed, 'Layouts use the existing page form').toEqual([true, false, false]);
}

async function assertMeasuredLayoutPageCases(unit: ComponentManifest, item: ContractCase) {
	await measureWorkload(
		'validator.verification-evidence-test-case',
		'layout-page-case-admission',
		() => assertLayoutPageCases(unit, item)
	);
}
