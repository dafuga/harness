import { caseShapeErrors, declaredInputErrors } from './test-case-validator/caseShapeErrors';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { TestContract } from '../../services/verification-evidence/TestContractService.types';
import type { TestCaseValidatorResult } from './TestCaseValidator.types';
import { testContractSchema } from '../../services/verification-evidence/test-contract-service/testContractSchema';
import { exampleCaseErrors } from './test-case-validator/exampleCaseErrors';
import { declaredStateErrors, methodCaseErrors } from './test-case-validator/declaredCaseErrors';

/** Admission checks authored coverage, not merely test-file naming. */
export class TestCaseValidator {
	validate(unit: ComponentManifest, input: unknown): TestCaseValidatorResult {
		const parsed = testContractSchema.safeParse(input);
		if (!parsed.success)
			return {
				valid: false,
				errors: parsed.error.issues.map(
					(issue) => `${unit.id}: ${issue.path.join('.')}: ${issue.message}`
				)
			};
		const contract = parsed.data;
		const errors = [...this.identities(unit.id, contract), ...this.coverage(unit, contract)];
		return { valid: errors.length === 0, errors };
	}
	private identities(unit: string, contract: TestContract): string[] {
		const seen = new Set<string>();
		return contract.cases.flatMap((item) => {
			const errors = seen.has(item.id) ? [`${unit}: duplicate case ${item.id}`] : [];
			seen.add(item.id);
			if (contract.states && !contract.states.includes(item.state))
				errors.push(`${unit}: case ${item.id} names undeclared state ${item.state}`);
			errors.push(...caseShapeErrors(unit, contract, item));
			return errors;
		});
	}
	private coverage(unit: ComponentManifest, contract: TestContract): string[] {
		const errors = [
			...declaredStateErrors(unit.id, contract),
			...(contract.states ?? [])
				.filter((state) => !contract.cases.some((item) => item.state === state))
				.map((state) => `${unit.id}: missing state ${state}`)
		];
		if (contract.shape === 'component' && !contract.cases.some((item) => item.state === 'rest'))
			errors.push(`${unit.id}: component requires its rest state`);
		if (contract.shape === 'helper') errors.push(...exampleCaseErrors(unit, contract));
		if (contract.shape === 'service') errors.push(...methodCaseErrors(unit, contract));
		errors.push(...declaredInputErrors(unit, contract));
		return errors;
	}
}
export type { TestCaseValidatorResult } from './TestCaseValidator.types';
