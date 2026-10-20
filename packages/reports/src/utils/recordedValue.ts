/** A bounded reading of already-parsed evidence; original values are never rewritten. */
export type RecordedNode =
	| { kind: 'scalar'; type: string; text: string; shortened?: boolean }
	| { kind: 'notice'; text: string }
	| { kind: 'fields'; fields: Array<{ name: string; node: RecordedNode }>; remaining: number }
	| { kind: 'list'; items: RecordedNode[]; remaining: number }
	| { kind: 'table'; columns: string[]; rows: RecordedNode[][]; remaining: number };

const more = (): RecordedNode => ({
	kind: 'notice',
	text: 'Open Full recorded values to see more.'
});

const scalar = (value: unknown) => value === null || typeof value !== 'object';

const types: Record<string, string> = { string: 'Text', number: 'Number', boolean: 'Boolean' };

function leaf(value: unknown): RecordedNode {
	if (value === undefined) return { kind: 'notice', text: 'Not recorded' };
	if (value === null) return { kind: 'scalar', type: 'Null', text: 'null' };
	if (value === '') return { kind: 'notice', text: 'Empty text' };
	const text = String(value);
	return {
		kind: 'scalar',
		type: types[typeof value] ?? typeof value,
		text: text.slice(0, 240),
		...(text.length > 240 ? { shortened: true } : {})
	};
}

/** Flat records share columns; nested and mixed lists keep their own labelled values. */
function columns(items: unknown[]): string[] {
	const objects = items.filter(
		(item): item is Record<string, unknown> =>
			typeof item === 'object' && item !== null && !Array.isArray(item)
	);
	if (objects.length !== items.length) return [];
	const keys = [...new Set(objects.flatMap(Object.keys))];
	return keys.length <= 8 && objects.every((item) => Object.values(item).every(scalar)) ? keys : [];
}

export function read(value: unknown, depth: number, budget: { left: number }): RecordedNode {
	if (budget.left-- <= 0) return more();
	if (scalar(value)) return leaf(value);
	if (depth >= 4) return more();
	if (Array.isArray(value)) return list(value, depth, budget);
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return { kind: 'notice', text: 'Empty object' };
	return {
		kind: 'fields',
		fields: entries.slice(0, 12).map(([name, value]) => ({
			name,
			node: read(value, depth + 1, budget)
		})),
		remaining: Math.max(0, entries.length - 12)
	};
}

function list(values: unknown[], depth: number, budget: { left: number }): RecordedNode {
	if (values.length === 0) return { kind: 'notice', text: 'Empty list' };
	const items = values.slice(0, 12);
	const keys = columns(items);
	const remaining = Math.max(0, values.length - items.length);
	if (keys.length === 0) {
		return { kind: 'list', items: items.map((item) => read(item, depth + 1, budget)), remaining };
	}
	return {
		kind: 'table',
		columns: keys,
		rows: items.map((item) =>
			keys.map((key) => {
				const value = item as Record<string, unknown>;
				return read(Object.hasOwn(value, key) ? value[key] : undefined, depth + 1, budget);
			})
		),
		remaining
	};
}

export { recordedValue } from '../components/recorded-value/recordedValue';
