import { auditFileLength } from '../commonRules';
import { auditCurlyFunctions } from './blockHelpers';
import type { AuditAdapter, AuditFile } from './types';

const functionStart =
	/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+\w+/;
const literals = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)'|\/\/.*$/g;

export const rustAdapter: AuditAdapter = {
	id: 'rust',
	label: 'Rust',
	profiles: ['dapp', 'lib'],
	extensions: ['.rs'],
	optionalTools: ['cargo fmt', 'cargo clippy'],
	audit(file) {
		const structural = file.lines.map(maskLiterals);
		return [
			...auditFileLength(file.relativePath, file.lines, file.limits),
			...auditCurlyFunctions(file.relativePath, structural, startsRustFunction, file.limits),
			...auditUnsafe(file, structural)
		];
	}
};

/** Replaces strings and character literals and drops line comments, so only code braces count. */
function maskLiterals(line: string): string {
	return line.replace(literals, (text) => (text.startsWith('//') ? '' : '_'.repeat(text.length)));
}

/** A signature that ends in a semicolon declares a function without defining a body. */
function startsRustFunction(line: string): boolean {
	return functionStart.test(line) && !line.trimEnd().endsWith(';');
}

/** Unsafe blocks state why they are sound; unsafe functions document their contract. */
function auditUnsafe(file: AuditFile, structural: string[]) {
	return structural.flatMap((line, index) => {
		const block = /\bunsafe\s*\{/.test(line);
		const declaration = /\bunsafe\s+(?:extern\s+\S+\s+)?fn\b/.test(line);
		if (!block && !declaration) return [];
		const marker = block ? '// SAFETY:' : '# Safety';
		const above = file.lines.slice(Math.max(0, index - (block ? 3 : 8)), index);
		if (above.some((previous) => previous.includes(marker))) return [];
		return [
			{
				path: file.relativePath,
				rule: block ? 'rust-unsafe-comment' : 'rust-unsafe-contract',
				message: block
					? `Unsafe code near line ${index + 1} needs a preceding // SAFETY: comment.`
					: `Unsafe function near line ${index + 1} needs a # Safety doc section.`
			}
		];
	});
}
