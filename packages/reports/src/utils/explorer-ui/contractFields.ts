import type { Guess } from './contractFields.types';

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
} from '../../components/explorer-ui/entity-contract/contractFields';

export type { ContractExample, ContractField, ContractGroup } from './contractFields.types';
