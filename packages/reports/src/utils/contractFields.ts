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
	/** Readable component field name or the exact callable parameter identifier. */
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
	/** Return tables show the value type without a redundant name column. */
	hideNames?: boolean;
	/** Keep an empty API table with an explicit absence message. */
	keepEmpty?: boolean;
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

export /** A placeholder for a type made only of plain data; undefined for an opaque one. */
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

export {
	typeLabel,
	contractFields,
	contractFacts
} from '../components/entity-contract/contractFields';
