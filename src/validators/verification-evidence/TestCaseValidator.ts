import { caseShapeErrors, declaredInputErrors } from './test-case-validator/caseShapeErrors';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { TestContract } from '../../services/verification-evidence/TestContractService.types';
import type { TestCaseValidatorResult } from './TestCaseValidator.types';
import { testContractSchema } from '../../services/verification-evidence/test-contract-service/testContractSchema';

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
		const errors = (contract.states ?? [])
			.filter((state) => !contract.cases.some((item) => item.state === state))
			.map((state) => `${unit.id}: missing state ${state}`);
		if (contract.shape === 'component' && !contract.cases.some((item) => item.state === 'rest'))
			errors.push(`${unit.id}: component requires its rest state`);
		if (contract.shape === 'helper') errors.push(...this.examples(unit, contract));
		if (contract.shape === 'service') errors.push(...this.methods(unit, contract));
		errors.push(...declaredInputErrors(unit, contract));
		return errors;
	}
	private examples(unit: ComponentManifest, contract: TestContract): string[] {
		const examples = [
			...(unit.helperContracts ?? []).flatMap((helper) =>
				(helper.examples ?? []).map((example) => ({ subject: helper.name, name: example.name }))
			),
			...(contract.examples ?? [])
		];
		const errors = examples.length ? [] : [`${unit.id}: helper requires authored Examples`];
		const identities = examples.map((item) => `${item.subject}/${item.name}`);
		if (new Set(identities).size !== identities.length)
			errors.push(`${unit.id}: duplicate authored example`);
		for (const example of examples) {
			const matches = contract.cases.filter(
				(item) => item.subject === example.subject && item.example === example.name
			);
			if (matches.length !== 1 || matches[0].test.title !== `${example.subject}: ${example.name}`)
				errors.push(
					`${unit.id}: example ${example.subject}/${example.name} requires exactly one case with its canonical registered title`
				);
		}
		for (const item of contract.cases)
			if (
				!examples.some(
					(example) => example.subject === item.subject && example.name === item.example
				)
			)
				errors.push(`${unit.id}: orphaned example case ${item.id}`);
		return errors;
	}
	private methods(unit: ComponentManifest, contract: TestContract): string[] {
		const methods = unit.owns.symbols.filter(
			(name) => name.includes('.') && !name.endsWith('.constructor')
		);
		return methods.flatMap((subject) =>
			(contract.states ?? ['initialized'])
				.filter(
					(state) =>
						!contract.cases.some((item) => item.subject === subject && item.state === state)
				)
				.map((state) => `${unit.id}: missing method/state ${subject}/${state}`)
		);
	}
}
export type { TestCaseValidatorResult } from './TestCaseValidator.types';
