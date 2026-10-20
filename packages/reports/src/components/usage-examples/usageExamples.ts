import type { UsageExample } from '../../../../../src/utils/unit-documentation/unitDocumentation';
type Fields = Record<string, unknown>;
type Result = { failed: boolean; value: unknown };
/** One difference from the first example; an undefined side is a field absent there. */
export type UsageChange = { field?: string; was?: unknown; now?: unknown; kinds?: string[] };
const fields = (value: unknown): Fields | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
const pair = ([key, item]: [string, unknown]) => `${JSON.stringify(key)}: ${compact(item)}`;
/** Compact JSON spaced after separators so it wraps; no value is shortened away. */
export function compact(value: unknown): string {
	const object = fields(value);
	if (Array.isArray(value)) return `[${value.map(compact).join(', ')}]`;
	if (!object) return JSON.stringify(value) ?? String(value);
	const entries = Object.entries(object).map(pair);
	return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}
const order = ([a]: [string, unknown], [b]: [string, unknown]) => {
	if (a === b) return 0;
	return a < b ? -1 : 1;
};
const sorted = (object: Fields) => Object.fromEntries(Object.entries(object).sort(order));
/** The same text for equal values whatever order their properties were written in. */
const canonical = (value: unknown): string | undefined =>
	JSON.stringify(value, (_key, item: unknown) => (fields(item) ? sorted(item as Fields) : item));
const own = (of: Fields, key: string) => (Object.hasOwn(of, key) ? of[key] : undefined);
/** What a later expected result changes from the first: by top-level field between objects. */
function compare(base: Result, next: Result): UsageChange[] {
	const whole = { was: base.value, now: next.value };
	const kinds = base.failed ? ['error', 'output'] : ['output', 'error'];
	if (base.failed !== next.failed) return [{ ...whole, kinds }];
	const [before, after] = [fields(base.value), fields(next.value)];
	if (!before || !after) return canonical(base.value) === canonical(next.value) ? [] : [whole];
	return [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.map((field) => ({ field, was: own(before, field), now: own(after, field) }))
		.filter(({ was, now }) => canonical(was) !== canonical(now));
}
const expected = ({ output, error }: UsageExample): Result =>
	error !== undefined ? { failed: true, value: error } : { failed: false, value: output };

/** Expected results with the changes each makes from the first documented call. */
export function usageExamples(examples: UsageExample[]) {
	const results = examples.map(expected);
	return results.map((outcome) => ({ outcome, changes: compare(results[0], outcome) }));
}
