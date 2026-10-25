import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ContractCase,
	TestContract
} from '../../../services/verification-evidence/TestContractService.types';
import type { AuthoredExampleField, ExampleReference } from './exampleCaseErrors.types';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';

/** Read authored payloads only when checking a duplicated field in a case. */
function exampleReferences(unit: ComponentManifest, contract: TestContract): ExampleReference[] {
	return [
		...(unit.helperContracts ?? []).flatMap((helper) =>
			(helper.examples ?? []).map((example) => ({
				subject: helper.name,
				name: example.name,
				read: (field: AuthoredExampleField) => {
					if (field !== 'expected') return example[field];
					if (example.returns === 'void') return { kind: 'void' };
					return Object.hasOwn(example, 'error')
						? { kind: 'error', value: example.error }
						: { kind: 'value', value: example.output };
				}
			}))
		),
		...(contract.examples ?? []).map((example) => ({
			subject: example.subject,
			name: example.name,
			read: (field: AuthoredExampleField) => example[field]
		}))
	];
}

/** One canonical case per owned callable Example, with no contradictory duplicated payloads. */
export function exampleCaseErrors(unit: ComponentManifest, contract: TestContract): string[] {
	const examples = exampleReferences(unit, contract);
	const errors = examples.length ? [] : [`${unit.id}: helper requires authored Examples`];
	const identities = examples.map((item) => `${item.subject}/${item.name}`);
	if (new Set(identities).size !== identities.length)
		errors.push(`${unit.id}: duplicate authored example`);
	for (const example of examples) {
		if (!unit.owns.symbols.includes(example.subject))
			errors.push(`${unit.id}: unknown example subject ${example.subject}`);
		const matches = contract.cases.filter(
			(item) => item.subject === example.subject && item.example === example.name
		);
		if (matches.length !== 1 || matches[0].test.title !== `${example.subject}: ${example.name}`)
			errors.push(
				`${unit.id}: example ${example.subject}/${example.name} requires exactly one case with its canonical registered title`
			);
		for (const item of matches) errors.push(...duplicatedFieldErrors(unit.id, example, item));
	}
	for (const item of contract.cases)
		if (
			!examples.some((example) => example.subject === item.subject && example.name === item.example)
		)
			errors.push(`${unit.id}: orphaned example case ${item.id}`);
	return errors;
}

function duplicatedFieldErrors(
	unit: string,
	example: ExampleReference,
	item: ContractCase
): string[] {
	const fields: AuthoredExampleField[] = ['input', 'call', 'expected'];
	return fields
		.filter(
			(field) =>
				item[field] !== undefined &&
				canonicalJson(item[field]) !== canonicalJson(example.read(field))
		)
		.map((field) => `${unit}: case ${item.id} ${field} contradicts its authored Example`);
}
