import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { ContractCase } from '../TestContractService.types';

/** An added capability permits its own new case; supported existing identities stay intact. */
export function caseIdentityChanges(before: ComponentManifest, after: ComponentManifest): string[] {
	const prior = before.testing!.cases,
		next = after.testing!.cases;
	const errors: string[] = [];
	const refuse = (item: ContractCase) =>
		errors.push(
			`${after.id}/${item.subject ?? after.id}: case identities/count changed without a matching declared capability change; strengthen existing cases for bugs`
		);
	for (const item of prior) {
		const current = next.find((candidate) => candidate.id === item.id);
		if (!current && stillSupported(before, after, item)) refuse(item);
		else if (
			current &&
			(identity(before, item) !== identity(after, current) ||
				current.test.title !== item.test.title)
		)
			refuse(item);
	}
	for (const item of next)
		if (
			!prior.some((candidate) => candidate.id === item.id) &&
			!addedCapability(before, after, item)
		)
			refuse(item);
	return errors;
}

function identity(unit: ComponentManifest, item: ContractCase): string {
	return JSON.stringify([unit.testing!.shape, item.subject, item.state, item.example]);
}
function hasExample(unit: ComponentManifest, item: ContractCase): boolean {
	if (
		unit.helperContracts?.some(
			(helper) =>
				helper.name === item.subject &&
				helper.examples?.some((example) => example.name === item.example)
		)
	)
		return true;
	return Boolean(
		unit.testing?.examples?.some(
			(example) => example.subject === item.subject && example.name === item.example
		)
	);
}
function stillSupported(
	before: ComponentManifest,
	after: ComponentManifest,
	item: ContractCase
): boolean {
	const contract = after.testing!;
	if (before.testing!.shape !== contract.shape) return false;
	if (contract.states && !contract.states.includes(item.state)) return false;
	if (item.example) return hasExample(after, item);
	if (contract.shape === 'service' && item.subject)
		return after.owns.symbols.includes(item.subject);
	return (
		!(item.props ?? []).some(
			(prop) => before.testing!.props?.includes(prop) && !contract.props?.includes(prop)
		) &&
		!(item.errors ?? []).some(
			(error) =>
				before.contract.errors.some((field) => field.name === error) &&
				!after.contract.errors.some((field) => field.name === error)
		)
	);
}
function addedCapability(
	before: ComponentManifest,
	after: ComponentManifest,
	item: ContractCase
): boolean {
	if (item.example) return hasExample(after, item) && !hasExample(before, item);
	const prior = before.testing!;
	const states = prior.states ?? prior.cases.map((row) => row.state);
	if (after.testing!.states?.includes(item.state) && !states.includes(item.state)) return true;
	if (
		item.subject &&
		after.owns.symbols.includes(item.subject) &&
		!before.owns.symbols.includes(item.subject)
	)
		return true;
	return false;
}
