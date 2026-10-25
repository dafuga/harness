import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { ContractRegistry } from './TestContractService.types';
import { TestCaseValidator } from '../../validators/verification-evidence/TestCaseValidator';
import { caseIdentityChanges } from './test-contract-service/caseIdentityChanges';
import { executionCaseErrors } from './test-contract-service/executionCaseErrors';

/** Checks case ownership, discovery and history without changing expected results. */
export class TestContractService {
	validate(registry: ContractRegistry): string[] {
		const validator = new TestCaseValidator();
		const active = registry.units.filter((unit) => unit.status === 'active');
		const errors = active.flatMap((unit) => {
			if (!unit.testing)
				return registry.required && this.executable(unit)
					? [`${unit.id}: missing standardized test contract`]
					: [];
			return [...validator.validate(unit, unit.testing).errors, ...this.files(unit, registry)];
		});
		const claimed = active.flatMap((unit) =>
			(unit.testing?.cases ?? []).map((item) => `${item.test.file}\0${item.test.title}`)
		);
		for (const key of new Set(claimed))
			if (claimed.filter((item) => item === key).length > 1)
				errors.push(`Duplicate test registration: ${key.replace('\0', ': ')}`);
		for (const test of registry.tests ?? [])
			if (!claimed.includes(`${test.file}\0${test.title}`))
				errors.push(`Unsupported or orphaned test: ${test.file}: ${test.title}`);
		return [...errors, ...this.scenarios(registry), ...executionCaseErrors(registry)];
	}
	compare(before: ComponentManifest[], after: ComponentManifest[]): string[] {
		const previous = new Map(before.map((unit) => [unit.id, unit]));
		return after.flatMap((unit) => {
			const base = previous.get(unit.id);
			if (!base?.testing || unit.status !== 'active') return [];
			if (!unit.testing) return [`${unit.id}: standardized cases cannot be removed`];
			return caseIdentityChanges(base, unit);
		});
	}
	private executable(unit: ComponentManifest): boolean {
		return (
			!['config', 'style', 'types', 'type'].includes(unit.kind) && unit.owns.symbols.length > 0
		);
	}
	private files(unit: ComponentManifest, registry: ContractRegistry): string[] {
		return (unit.testing?.cases ?? []).flatMap((item) => {
			const errors = registry.files.has(item.test.file)
				? []
				: [`${unit.id}: case ${item.id} names missing test ${item.test.file}`];
			if (item.fixture && !registry.files.has(item.fixture))
				errors.push(`${unit.id}: case ${item.id} names missing fixture ${item.fixture}`);
			if (
				registry.tests &&
				!registry.tests.some(
					(test) => test.file === item.test.file && test.title === item.test.title
				)
			)
				errors.push(`${unit.id}: case ${item.id} was not discovered`);
			return errors;
		});
	}
	private scenarios(registry: ContractRegistry): string[] {
		const units = new Map(registry.units.map((unit) => [unit.id, unit]));
		return registry.scenarios.flatMap((scenario) =>
			scenario.tests.flatMap((test) =>
				(test.cases ?? []).flatMap((reference) => {
					const unit = units.get(reference.unit);
					const item = unit?.testing?.cases.find((item) => item.id === reference.case);
					if (!scenario.units.includes(reference.unit) || !item)
						return [`${scenario.id}: orphaned case ${reference.unit}/${reference.case}`];
					const state = scenario.states.find((state) => state.id === item.state);
					if (state?.coverage !== 'required')
						return [`${scenario.id}: case ${item.id} requires a covered state ${item.state}`];
					return [];
				})
			)
		);
	}
}
export type {
	TestContract,
	ContractCase,
	ContractRegistry,
	CaseOutcome,
	CaseExecution
} from './TestContractService.types';
