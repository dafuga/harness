import type { SourceNesting } from './sourceNesting.types';

/** Computes bracket depths over masked source so literal contents never count. */
export function sourceNesting(masked: string): SourceNesting {
	const brace = new Int32Array(masked.length + 1);
	const group = new Int32Array(masked.length + 1);
	for (let index = 0; index < masked.length; index += 1) {
		const char = masked[index];
		brace[index + 1] = brace[index] + delta(char, '{', '}');
		group[index + 1] = group[index] + delta(char, '(', ')') + delta(char, '[', ']');
	}
	return { brace, group };
}

/** Index of the brace closing the one opened at `open`. */
export function matchingBrace(nesting: SourceNesting, open: number): number {
	const target = nesting.brace[open];
	for (let index = open + 1; index < nesting.brace.length - 1; index += 1) {
		if (nesting.brace[index + 1] === target) return index;
	}
	return nesting.brace.length - 2;
}

/** Inclusive end of the function body that follows `from`, or -1 for a bodiless signature. */
export function bodyEnd(masked: string, nesting: SourceNesting, from: number): number {
	const group = nesting.group[from];
	for (let index = from; index < masked.length; index += 1) {
		if (nesting.group[index] !== group) continue;
		if (masked[index] === ';') return -1;
		if (masked[index] !== '{') continue;
		const close = matchingBrace(nesting, index);
		if (!/^[ \t]*(?:[{|&[>,)]|=>)/.test(masked.slice(close + 1, close + 40))) return close;
		index = close;
	}
	return -1;
}

function delta(char: string, open: string, close: string): number {
	if (char === open) return 1;
	return char === close ? -1 : 0;
}

export { statementEnd } from './block-spans/statementEnd';

export type { SourceNesting } from './sourceNesting.types';
