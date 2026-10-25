import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { stableJson } from '../../../utils/development-tooling/stableJson';

/** A sibling's new example must never authorize this callable's case identity change. */
export function caseIdentityChanges(before: ComponentManifest, after: ComponentManifest): string[] {
	const old = before.testing!.cases,
		next = after.testing!.cases;
	const subjects = new Set([...old, ...next].map((item) => item.subject ?? before.id));
	return [...subjects].flatMap((subject) => {
		const prior = old
			.filter((item) => (item.subject ?? before.id) === subject)
			.map((item) => item.id)
			.sort();
		const current = next
			.filter((item) => (item.subject ?? after.id) === subject)
			.map((item) => item.id)
			.sort();
		if (
			stableJson(prior) === stableJson(current) ||
			capabilities(before, subject) !== capabilities(after, subject)
		)
			return [];
		return [
			`${after.id}/${subject}: case identities/count changed without declared capability changes; strengthen existing cases for bugs`
		];
	});
}
function capabilities(unit: ComponentManifest, subject: string): string {
	const belongs = (name: string) =>
		subject === unit.id || name === subject || name.startsWith(`${subject}.`);
	return stableJson({
		inputs: unit.contract.inputs
			.filter((item) => belongs(item.name))
			.map(({ name, type }) => [name, type])
			.sort(),
		outputs: unit.contract.outputs
			.filter((item) => belongs(item.name))
			.map(({ name, type }) => [name, type])
			.sort(),
		errors: unit.contract.errors.map(({ name, type }) => [name, type]).sort(),
		helpers: unit.helperContracts
			?.filter((helper) => belongs(helper.name))
			.map((helper) => ({
				name: helper.name,
				inputs: helper.inputs.map(({ name, type }) => [name, type]).sort(),
				output: helper.output,
				examples: helper.examples?.map((example) => example.name).sort()
			}))
			.sort((left, right) => left.name.localeCompare(right.name)),
		symbols: [...new Set(unit.owns.symbols.filter(belongs))].sort(),
		examples: unit.testing?.examples
			?.filter((item) => belongs(item.subject))
			.map(({ subject, name }) => [subject, name])
			.sort(),
		shape: unit.testing?.shape,
		states: unit.testing?.states?.slice().sort(),
		props: unit.testing?.props?.slice().sort()
	});
}
