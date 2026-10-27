import { expect } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { ContractCase } from '../../../src/services/verification-evidence/TestContractService';
import type {
	MethodLifecycleValidator,
	SyntheticMethodLifecycleContract,
	SyntheticMethodLifecycleFixture
} from './test-case.test.types';

export const methodLifecycleDiagnostics = {
	missingPair: 'missing method/state pair: Synthetic.run/cancelled',
	undeclaredPair: 'undeclared method/state pair: Synthetic.ready/cancelled',
	missingMethod: 'missing methodStates declaration for owned method: Synthetic.run',
	unknownMethod: 'methodStates references an unknown method',
	constructorMethod: 'methodStates cannot declare constructor methods',
	emptyMap: 'methodStates must not be empty',
	emptyList: 'methodStates for Synthetic.ready must not be empty',
	duplicateStates: 'methodStates for Synthetic.ready contains duplicate states',
	invalidState: 'methodStates contains an invalid state identifier',
	unsupportedShape: 'methodStates is only supported for service contracts',
	ambiguousGlobalStates: 'methodStates cannot be combined with global states'
} as const;

export function assertMethodSpecificLifecycleCases(
	validator: MethodLifecycleValidator,
	unit: ComponentManifest,
	item: ContractCase
) {
	const { owner, contract } = syntheticMethodLifecycleFixture(unit, item);
	const validate = (input: unknown) => validator.validate(owner, input);

	assertCompleteMethodLifecyclePairs(validate, contract);
	assertMethodDeclarationDiagnostics(validate, contract);
	assertMethodStateDeclarationDiagnostics(validate, contract);
	assertLifecycleScopeDiagnostics(validate, contract);
	assertDuplicateMethodLifecycleCase(validate, contract);
}

function assertCompleteMethodLifecyclePairs(
	validate: (input: unknown) => { valid: boolean; errors: string[] },
	contract: SyntheticMethodLifecycleContract
) {
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
}

function assertMethodDeclarationDiagnostics(
	validate: (input: unknown) => { valid: boolean; errors: string[] },
	contract: SyntheticMethodLifecycleContract
) {
	const missingMethodDeclaration = validate({
		...contract,
		methodStates: { 'Synthetic.ready': ['qualified', 'unconfigured'] }
	});
	expect(missingMethodDeclaration.valid).toBe(false);
	expect(missingMethodDeclaration.errors).toContain(methodLifecycleDiagnostics.missingMethod);

	const unknownMethod = validate({
		...contract,
		methodStates: { ...contract.methodStates, 'Synthetic.unknown': ['qualified'] }
	});
	expect(unknownMethod.valid).toBe(false);
	expect(unknownMethod.errors).toContain(methodLifecycleDiagnostics.unknownMethod);

	const constructorMethod = validate({
		...contract,
		methodStates: { ...contract.methodStates, 'Synthetic.constructor': ['qualified'] }
	});
	expect(constructorMethod.valid).toBe(false);
	expect(constructorMethod.errors).toContain(methodLifecycleDiagnostics.constructorMethod);
}

function assertMethodStateDeclarationDiagnostics(
	validate: (input: unknown) => { valid: boolean; errors: string[] },
	contract: SyntheticMethodLifecycleContract
) {
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
		methodStates: { ...contract.methodStates, 'Synthetic.ready': ['qualified', 'qualified'] }
	});
	expect(duplicateStates.valid).toBe(false);
	expect(duplicateStates.errors).toContain(methodLifecycleDiagnostics.duplicateStates);

	const invalidState = validate({
		...contract,
		methodStates: { ...contract.methodStates, 'Synthetic.ready': ['not a state'] }
	});
	expect(invalidState.valid).toBe(false);
	expect(invalidState.errors).toContain(methodLifecycleDiagnostics.invalidState);
}

function assertLifecycleScopeDiagnostics(
	validate: (input: unknown) => { valid: boolean; errors: string[] },
	contract: SyntheticMethodLifecycleContract
) {
	const nonServiceShape = validate({ ...contract, shape: 'component' });
	expect(nonServiceShape.valid).toBe(false);
	expect(nonServiceShape.errors).toContain(methodLifecycleDiagnostics.unsupportedShape);

	const ambiguousGlobalStates = validate({
		...contract,
		states: ['qualified', 'unconfigured', 'cancelled']
	});
	expect(ambiguousGlobalStates.valid).toBe(false);
	expect(ambiguousGlobalStates.errors).toContain(methodLifecycleDiagnostics.ambiguousGlobalStates);
}

function assertDuplicateMethodLifecycleCase(
	validate: (input: unknown) => { valid: boolean; errors: string[] },
	contract: SyntheticMethodLifecycleContract
) {
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

export function syntheticMethodLifecycleFixture(
	unit: ComponentManifest,
	item: ContractCase
): SyntheticMethodLifecycleFixture {
	const owner = {
		...unit,
		owns: { ...unit.owns, symbols: ['Synthetic.ready', 'Synthetic.run'] }
	};
	const methodStates = {
		'Synthetic.ready': ['qualified', 'unconfigured'],
		'Synthetic.run': ['qualified', 'cancelled']
	};
	const cases = Object.entries(methodStates).flatMap(([subject, states]) =>
		states.map((state) => ({
			...item,
			id: subject + '.' + state,
			subject,
			state,
			test: { ...item.test, title: subject + ' ' + state }
		}))
	);

	return {
		owner,
		contract: {
			version: 1,
			shape: 'service',
			methodStates,
			cases
		}
	};
}
