import type { ExplorerCategory } from '../models/Explorer.types';
import type { HarnessUnit } from '../models/Harness.types';
import { humanize, type ContractRow } from './entityContract';

type Item = HarnessUnit['contract']['inputs'][number];
type Guess = { value: unknown } | undefined;

/** One example of a field, with the exact text it is shown as. */
export interface ContractExample {
	/** A literal is one JSON value; markup is shown as written; a structure is read as fields. */
	form: 'literal' | 'markup' | 'structure';
	value: unknown;
	text: string;
}

/** One input, output or error as a person reads it. */
export interface ContractField {
	/** Words a reader is shown; never a file or a module path. */
	name: string;
	/** The public type as declared, without the module an inferred type is imported from. */
	type: string;
	description?: string;
	/**
	 * `declared` when the contract records examples; `illustrative` when it records none and the
	 * type is plain data a placeholder can show; `missing` when it is neither.
	 */
	source: 'declared' | 'illustrative' | 'missing';
	examples: ContractExample[];
}

export interface ContractGroup {
	id: 'inputs' | 'outputs' | 'errors';
	title: string;
	/** What is said when the contract declares none. */
	none: string;
	fields: ContractField[];
}

/** Placeholders for types whose every value is plain data: nothing meaningful is invented. */
const placeholders: Record<string, unknown> = {
	string: 'example',
	number: 1,
	boolean: true,
	null: null,
	unknown: null,
	any: null,
	object: {},
	'{}': {},
	markup: '<p>Example</p>'
};
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

/** The members of a union at its top level; a type of any other form is its one member. */
function members(type: string): string[] {
	const parts: string[] = [];
	let [depth, start] = [0, 0];
	for (let at = 0; at < type.length; at++) {
		if ('(<{['.includes(type[at])) depth++;
		else if (')>}]'.includes(type[at])) depth--;
		else if (type[at] === '|' && depth === 0) {
			parts.push(type.slice(start, at));
			start = at + 1;
		}
	}
	parts.push(type.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** The type of the items of a list type; undefined for a type that is no list. */
function elementOf(type: string): string | undefined {
	const generic = /^(?:Readonly)?Array<(.+)>$/.exec(type);
	if (generic) return generic[1];
	if (!type.endsWith('[]')) return undefined;
	const inner = type.slice(0, -2).trim();
	return inner.startsWith('(') && inner.endsWith(')') ? inner.slice(1, -1) : inner;
}

/** A literal type as the one value it allows. */
function literalOf(type: string): Guess {
	const quoted = /^(['"])(.*)\1$/.exec(type);
	if (quoted) return { value: quoted[2] };
	if (/^-?\d+(\.\d+)?$/.test(type)) return { value: Number(type) };
	if (type === 'true' || type === 'false') return { value: type === 'true' };
	return undefined;
}

/** A union shows one of its members when every member can be shown; a value before a null. */
function unionOf(parts: string[], depth: number): Guess {
	const guesses = parts.filter((part) => part !== 'undefined').map((part) => guess(part, depth));
	const known = guesses.filter((one): one is { value: unknown } => one !== undefined);
	if (known.length === 0 || known.length < guesses.length) return undefined;
	return known.find((one) => one.value !== null) ?? known[0];
}

/** A placeholder for a type made only of plain data; undefined for an opaque one. */
function guess(type: string, depth: number): Guess {
	const plain = type.trim().replace(/^readonly\s+/, '');
	if (depth > 4) return undefined;
	const parts = members(plain);
	if (parts.length > 1) return unionOf(parts, depth + 1);
	if (Object.hasOwn(placeholders, plain)) return { value: placeholders[plain] };
	if (/^Record<\s*string\s*,/.test(plain)) return { value: {} };
	const element = elementOf(plain);
	if (element === undefined) return literalOf(plain);
	const item = guess(element, depth + 1);
	return item && { value: [item.value] };
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
 * The name of a field in words, without the owner a name may say it of. What a component draws
 * is derived under the name of the component or of its file, which says nothing: it reads
 * rendered markup.
 */
function nameOf(item: Item, unit: HarnessUnit): string {
	const name = item.name.slice(item.name.lastIndexOf('.') + 1);
	const files = unit.owns.source.map((path) => path.slice(path.lastIndexOf('/') + 1).split('.')[0]);
	const own = [unit.title, ...unit.owns.symbols, ...files];
	const itself = item.type === 'markup' && own.includes(name);
	const words = itself ? 'rendered markup' : humanize(name);
	return words ? words[0].toUpperCase() + words.slice(1) : 'Unnamed';
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
