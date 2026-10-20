import type { ContractExample, ContractField, ContractGroup } from '../../utils/contractFields';
import { guess } from '../../utils/contractFields';
import type { ExplorerCategory } from '../../models/Explorer.types';
import type { HarnessUnit } from '../../models/Harness.types';
import { humanize, type ContractRow } from '../../utils/entityContract';

type Item = HarnessUnit['contract']['inputs'][number];

const targets: Record<string, string> = {
	module: 'Module',
	wasm: 'Wasm',
	process: 'Native process',
	http: 'HTTP'
};

/** The rows shown as groups of fields; every other row says something of the whole contract. */
const grouped = new Set(['Inputs', 'Output', 'Fails with', 'Provides']);

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

/**
 * Name a field in words, keeping its owner when sibling names would collide. Component outputs
 * derived under the component or file name read rendered markup.
 */
function nameOf(item: Item, unit: HarnessUnit): string {
	const name = item.name.slice(item.name.lastIndexOf('.') + 1);
	const files = unit.owns.source.map((path) => path.slice(path.lastIndexOf('/') + 1).split('.')[0]);
	const own = [unit.title, ...unit.owns.symbols, ...files];
	const itself = item.type === 'markup' && own.includes(name);
	const words = itself ? 'rendered markup' : humanize(name);
	const label = words ? words[0].toUpperCase() + words.slice(1) : 'Unnamed';
	const siblings = [unit.contract.inputs, unit.contract.outputs, unit.contract.errors].find(
		(fields) => fields.includes(item)
	);
	const ambiguous = siblings?.some(
		(field) => field.name !== item.name && humanize(field.name.split('.').at(-1)!) === words
	);
	const owner = humanize(item.name.slice(0, item.name.lastIndexOf('.')));
	if (!ambiguous || !item.name.includes('.') || !owner) return label;
	return `${owner[0].toUpperCase()}${owner.slice(1)} · ${label}`;
}

function fieldOf(item: Item, unit: HarnessUnit): ContractField {
	const type = typeLabel(item.type);
	const description = item.description?.trim();
	return {
		name: nameOf(item, unit),
		type,
		...(description ? { description } : {}),
		...examplesOf(item, type)
	};
}

/**
 * The inputs, outputs and errors of one unit, each field with its exact public type, what it is
 * in words and its examples. What a config outputs is what it provides. Computed for the one
 * entity that is open, never for a whole catalog.
 */
export function contractFields(unit: HarnessUnit, category: ExplorerCategory): ContractGroup[] {
	const { inputs, outputs, errors } = unit.contract;
	const fields = (items: Item[]) => items.map((item) => fieldOf(item, unit));
	const provides = category === 'configs';
	return [
		{ id: 'inputs', title: 'Inputs', none: 'No inputs declared.', fields: fields(inputs) },
		{
			id: 'outputs',
			title: provides ? 'Provides' : 'Outputs',
			none: provides ? 'Nothing provided is declared.' : 'No outputs declared.',
			fields: fields(outputs)
		},
		{ id: 'errors', title: 'Errors', none: 'No errors declared.', fields: fields(errors) }
	];
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
