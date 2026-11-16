// @harness-uid u_3gfk6b2moy
import type { CompactValue, Fields } from './usageExamples.types';
import type { UsageExample } from '../../../../../../src/utils/unit-documentation/unitDocumentation';
const fields = (value: CompactValue): Fields | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
const pair = ([key, item]: [string, CompactValue]) => `${JSON.stringify(key)}: ${compact(item)}`;
/** Compact JSON spaced after separators so it wraps; no value is shortened away. */
export function compact(value: CompactValue): string {
	const object = fields(value);
	if (Array.isArray(value)) return `[${value.map(compact).join(', ')}]`;
	if (!object) return JSON.stringify(value) ?? String(value);
	const entries = Object.entries(object).map(pair);
	return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

/** Literal usage code followed by its expected output or error as a comment. */
export function usageExamples(examples: UsageExample[], setup?: string): string[] {
	// Documented fields are typed unknown upstream; every JavaScript value is a CompactValue.
	return examples.map((example) => {
		const call =
			example.call ?? `// Call not documented\n// Input: ${compact(example.input as CompactValue)}`;
		const failed = example.error !== undefined;
		const result = (failed ? example.error : example.output) as CompactValue;
		const comment = failed ? '// throws' : '// =>';
		return [setup, call, `${comment} ${compact(result)}`].filter(Boolean).join('\n');
	});
}
