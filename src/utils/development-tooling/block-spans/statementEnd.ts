import type { SourceNesting } from '../sourceNesting';

const statementStarts =
	/^(?:export|const|let|var|function|class|import|interface|type|if|for|return|async|declare|enum)\b|^[})]/;

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

function startsStatement(masked: string, index: number): boolean {
	const rest = masked.slice(index, index + 40).trimStart();
	return rest === '' || statementStarts.test(rest);
}
