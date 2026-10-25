import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { TestContract } from '../../../services/verification-evidence/TestContractService.types';

/** No implicit state is substituted for the entity's authored matrix. */
export function declaredStateErrors(unit: string, contract: TestContract): string[] {
	if (!contract.states?.length) return [`${unit}: requires explicit declared states`];
	return new Set(contract.states).size === contract.states.length
		? []
		: [`${unit}: duplicate declared state`];
}

/** A class owns method/state rows, never class names or arbitrary function subjects. */
export function methodCaseErrors(unit: ComponentManifest, contract: TestContract): string[] {
	const methods = [...new Set(unit.owns.symbols)].filter((name) => name.includes('.'));
	const errors = methods.length ? [] : [`${unit.id}: class requires owned methods`];
	errors.push(
		...methods
			.filter((name) => !name.endsWith('.constructor'))
			.flatMap((subject) =>
				(contract.states ?? [])
					.filter(
						(state) =>
							!contract.cases.some((item) => item.subject === subject && item.state === state)
					)
					.map((state) => `${unit.id}: missing method/state ${subject}/${state}`)
			)
	);
	const seen = new Set<string>();
	for (const item of contract.cases) {
		const identity = `${item.subject}/${item.state}`;
		if (seen.has(identity))
			errors.push(`${unit.id}: requires exactly one method/state ${identity}`);
		seen.add(identity);
		if (!item.subject || !methods.includes(item.subject))
			errors.push(`${unit.id}: unknown method ${item.subject}`);
		if (!item.expected || !['value', 'error', 'void'].includes(item.expected.kind))
			errors.push(
				`${unit.id}: class case ${item.id} requires an authored value, error or void result`
			);
	}
	return errors;
}
