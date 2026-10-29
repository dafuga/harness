import type { ComponentManifest, ContractItem } from '../../core/development-tooling/unitTypes';

/** Contract readability is checked separately from the backward-compatible storage schema. */
export function contractFindings(unit: ComponentManifest): string[] {
	if (unit.status !== 'active') return [];
	const contract = unit.contract;
	const operations = [
		...(contract.operations ?? []),
		...(contract.initialization ?? []),
		...(contract.snippets ?? [])
	];
	const inputs = [...contract.inputs, ...operations.flatMap((operation) => operation.inputs)];
	const errors = [...contract.errors, ...operations.flatMap((operation) => operation.errors)];
	return [
		...new Set([
			...inputs.flatMap((item) => inputFindings(unit.id, item)),
			...errors
				.filter((item) => item.name === 'Error' || item.type === 'Error')
				.map((item) => `${unit.id}: contract error ${item.name} is a bare Error`)
		])
	];
}

function inputFindings(id: string, item: ContractItem): string[] {
	const label = `${id}: contract input ${item.name}`;
	const empty = /\.props$/.test(item.name) && /^\{\s*\}$/.test(item.type);
	return [
		...(/\bunknown\b/.test(item.type) ? [`${label} has unknown type`] : []),
		...(empty ? [`${label} is an empty props blob`] : []),
		...(item.required === undefined ? [`${label} is missing required`] : [])
	];
}

export function contractFailureCounts(units: ComponentManifest[]) {
	const findings = units
		.map((unit) => ({ unit: unit.id, errors: contractFindings(unit) }))
		.filter((item) => item.errors.length);
	return {
		entities: findings.length,
		issues: findings.reduce((sum, item) => sum + item.errors.length, 0),
		unknownTypes: findings.filter((item) =>
			item.errors.some((error) => error.endsWith('has unknown type'))
		).length,
		emptyProps: findings.filter((item) =>
			item.errors.some((error) => error.endsWith('is an empty props blob'))
		).length,
		missingRequired: findings.filter((item) =>
			item.errors.some((error) => error.endsWith('is missing required'))
		).length,
		bareErrors: findings.filter((item) =>
			item.errors.some((error) => error.endsWith('is a bare Error'))
		).length
	};
}
