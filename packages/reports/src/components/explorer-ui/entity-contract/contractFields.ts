import type { Item, CallableContract } from './contractFields.types';
import type {
	ContractExample,
	ContractField,
	ContractGroup
} from '../../../utils/explorer-ui/contractFields';
import { guess } from '../../../utils/explorer-ui/contractFields';
import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
import { type ContractRow } from '../../../utils/explorer-ui/entityContract';
import { humanize } from '../../../helpers/strings/humanize';

const targets: Record<string, string> = {
	module: 'Module',
	wasm: 'Wasm',
	process: 'Native process',
	http: 'HTTP'
};

/** The rows shown as groups of fields; every other row says something of the whole contract. */
const grouped = new Set(['Inputs', 'Props', 'Output', 'Fails with', 'Provides']);

/** A type as it is declared, without the module path an inferred type is imported from. */
export function typeLabel(type: string): string {
	const bare = type.replace(/import\(\s*(['"`])[^'"`]*\1\s*\)\.?/g, '').replace(/\s+/g, ' ');
	return bare.trim() || 'module';
}

/** One example with the exact text it is shown as; markup stays as it was written. */
function shown(value: unknown, markup: boolean): ContractExample {
	if (markup && typeof value === 'string' && value !== '') {
		return { form: 'markup', value, text: value };
	}
	if (value === null || typeof value !== 'object' || Object.keys(value).length === 0) {
		return { form: 'literal', value, text: JSON.stringify(value) ?? String(value) };
	}
	return { form: 'structure', value, text: JSON.stringify(value, null, 2) };
}

/** The examples its contract declares, false, 0, null and empty text kept; else a placeholder. */
function examplesOf(item: Item, type: string): Pick<ContractField, 'source' | 'examples'> {
	const markup = type === 'markup';
	if (item.examples && item.examples.length > 0) {
		return { source: 'declared', examples: item.examples.map((value) => shown(value, markup)) };
	}
	const placeholder = guess(type, 0);
	if (!placeholder) return { source: 'missing', examples: [] };
	return { source: 'illustrative', examples: [shown(placeholder.value, markup)] };
}

/** Component fields read as words; their derived markup output reads rendered markup. */
function nameOf(item: Item, unit: HarnessUnit): string {
	const name = item.name.slice(item.name.lastIndexOf('.') + 1);
	const files = unit.owns.source.map((path) => path.slice(path.lastIndexOf('/') + 1).split('.')[0]);
	const own = [unit.title, ...unit.owns.symbols, ...files];
	const itself = item.type === 'markup' && own.includes(name);
	const words = itself ? 'rendered markup' : humanize(name);
	return words ? words[0].toUpperCase() + words.slice(1) : 'Unnamed';
}

export function fieldOf(item: Item, unit: HarnessUnit): ContractField {
	const type = typeLabel(item.type);
	const description = item.description?.trim();
	return {
		name: nameOf(item, unit),
		type,
		...(description ? { description } : {}),
		...examplesOf(item, type)
	};
}

/** Shared type modules show their own source declarations without runtime methods or examples. */
function typeGroups(unit: HarnessUnit): ContractGroup[] {
	return (unit.modelDefinitions ?? [])
		.filter((item) => item.kind !== 'class' && unit.owns.source.includes(item.source))
		.map((item, index) => ({
			id: `type-${index}`,
			title: item.name,
			none: 'No fields declared.',
			keepEmpty: true,
			fields: [
				...item.fields.map((field) => ({
					name: `${field.name}${field.optional ? '?' : ''}`,
					type: field.type
				})),
				...item.methods.map((method) => ({
					name: method.name,
					type: `(${method.inputs.map((input) => `${input.name}: ${input.type}`).join(', ')}): ${method.output}`
				})),
				...(item.type ? [{ name: item.name, type: item.type }] : [])
			].map((field) => ({ ...field, source: 'missing' as const, examples: [] }))
		}));
}

/**
 * The inputs, outputs and errors of one unit, each field with its exact public type, what it is
 * in words and its examples. What a config outputs is what it provides. Computed for the one
 * entity that is open, never for a whole catalog.
 */
export function contractFields(unit: HarnessUnit, category: ExplorerCategory): ContractGroup[] {
	if (category === 'types') return typeGroups(unit);
	const { inputs, outputs, errors } = unit.contract;
	const fields = (items: Item[]) => items.map((item) => fieldOf(item, unit));
	const component = category === 'components';
	const provides = category === 'configs';
	const groups: ContractGroup[] = [
		{
			id: 'inputs',
			title: component ? 'Props' : 'Inputs',
			none: component ? 'No props declared.' : 'No inputs declared.',
			fields: fields(inputs)
		}
	];
	if (!component)
		groups.push({
			id: 'outputs',
			title: provides ? 'Provides' : 'Outputs',
			none: provides ? 'Nothing provided is declared.' : 'No outputs declared.',
			fields: fields(outputs)
		});
	if (errors.length > 0)
		groups.push({
			id: 'errors',
			title: 'Errors',
			none: 'No errors declared.',
			fields: fields(errors)
		});
	return groups;
}

/**
 * What a contract says beside its fields: its purpose, app route and required states, as its
 * rows say them, and how it runs. A function says its execution targets, as a service does.
 */
export function contractFacts(
	rows: ContractRow[],
	unit: HarnessUnit,
	category: ExplorerCategory
): ContractRow[] {
	const facts = rows.filter((row) => !grouped.has(row.label));
	if (category !== 'functions') return facts;
	const kinds = unit.runtime.targets.map((target) => targets[target.kind] ?? target.kind);
	const fallback = targets[unit.runtime.kind] ?? unit.runtime.kind;
	return [...facts, { label: 'Runs as', value: [...new Set(kinds)].join(', ') || fallback }];
}

/** Each recorded callable keeps its own literal parameters and returned value. */
export function callableContracts(unit: HarnessUnit): CallableContract[] {
	const helpers = unit.helpers ?? [];
	return helpers.map((helper) => {
		const parameters = helper.inputs.map((input) => {
			const declared = unit.contract.inputs.find((field) => field.name === input.name) ?? input;
			const prefix = `${helper.name}.`;
			const name = input.name.startsWith(prefix) ? input.name.slice(prefix.length) : input.name;
			return { ...fieldOf(declared, unit), name };
		});
		const declared =
			unit.contract.outputs.find(
				(field) => field.name === helper.name || field.name.startsWith(`${helper.name}.`)
			) ?? (helpers.length === 1 ? unit.contract.outputs[0] : undefined);
		const type = typeLabel(helper.output ?? declared?.type ?? 'unknown');
		const returned = returnField(declared, type, helper.name, unit);
		const errors = unit.contract.errors.filter(
			(field) => helpers.length === 1 || field.name.startsWith(`${helper.name}.`)
		);
		const groups: ContractGroup[] = [
			{
				id: 'inputs',
				title: 'Parameters',
				none: 'No parameters.',
				fields: parameters,
				keepEmpty: true
			},
			{ id: 'outputs', title: 'Returns', none: '', fields: [returned] }
		];
		if (errors.length > 0)
			groups.push({
				id: 'errors',
				title: 'Throws',
				none: 'No errors declared.',
				fields: errors.map((field) => fieldOf(field, unit)),
				hideNames: true
			});
		const args = parameters.map((field) => `${field.name}: ${field.type}`).join(', ');
		return { name: helper.name, signature: `${helper.name}(${args}): ${type}`, groups };
	});
}

/** A return value has its own declared name, distinct from the callable that produces it. */
export function returnField(
	declared: Item | undefined,
	type: string,
	callable: string,
	unit: HarnessUnit
): ContractField {
	const prefix = `${callable}.`;
	const name =
		declared && declared.name !== callable ? declared.name.replace(prefix, '') : 'returnValue';
	if (type === 'void')
		return {
			name,
			type,
			source: 'missing',
			examples: [],
			description: 'This function returns no value.'
		};
	return { ...fieldOf({ ...declared, name, type }, unit), name };
}

export type { CallableContract } from './contractFields.types';
