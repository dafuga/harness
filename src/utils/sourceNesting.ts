export interface SourceNesting {
	/** Curly-brace depth before each character. */
	brace: Int32Array;
	/** Parenthesis and square-bracket depth before each character. */
	group: Int32Array;
}

const statementStarts =
	/^(?:export|const|let|var|function|class|import|interface|type|if|for|return|async|declare|enum)\b|^[})]/;

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

/** Inclusive end of the statement beginning at `start`. */
export function statementEnd(masked: string, nesting: SourceNesting, start: number): number {
	const brace = nesting.brace[start];
	const group = nesting.group[start];
	for (let index = start; index < masked.length; index += 1) {
		if (nesting.brace[index] !== brace || nesting.group[index] !== group) continue;
		if (masked[index] === ';') return index;
		if (masked[index] === '\n' && index > start && startsStatement(masked, index + 1)) {
			return index - 1;
		}
		if (masked[index] === '}') return index - 1;
	}
	return masked.length - 1;
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

function startsStatement(masked: string, index: number): boolean {
	const rest = masked.slice(index, index + 40).trimStart();
	return rest === '' || statementStarts.test(rest);
}

function delta(char: string, open: string, close: string): number {
	if (char === open) return 1;
	return char === close ? -1 : 0;
}
