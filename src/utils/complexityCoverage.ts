import { extname } from 'node:path';

/**
 * How far the decision points of one file are known: counted, none to count because the file
 * declares and does not decide, or not counted because nothing here reads its language.
 */
export type ComplexityCoverage = 'counted' | 'declarative' | 'unsupported';

const counted = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte']);
const declarative = new Set([
	'.css',
	'.json',
	'.toml',
	'.yml',
	'.yaml',
	'.md',
	'.txt',
	'.svg',
	'.lock'
]);
const named: Record<string, string> = {
	'.rs': 'Rust',
	'.py': 'Python',
	'.sh': 'shell',
	'.sql': 'SQL',
	'.go': 'Go',
	'.java': 'Java',
	'.kt': 'Kotlin',
	'.swift': 'Swift',
	'.c': 'C',
	'.h': 'C',
	'.cpp': 'C++',
	'.rb': 'Ruby',
	'.html': 'HTML with an inline script'
};

/**
 * Whether the decision points of a file are counted. Markup is declarative unless it carries a
 * script, which is code nobody here counts. An unknown kind of file is never assumed to hold no
 * decisions: only what is counted, or cannot decide anything, yields a number.
 */
export function complexityCoverage(path: string, scripted = false): ComplexityCoverage {
	const extension = extname(path).toLowerCase();
	if (counted.has(extension)) return 'counted';
	if (extension === '.html') return scripted ? 'unsupported' : 'declarative';
	return declarative.has(extension) ? 'declarative' : 'unsupported';
}

/** The language of a file whose decision points are not counted, as a reader would name it. */
export function uncountedLanguage(path: string): string {
	const extension = extname(path).toLowerCase();
	return named[extension] ?? (extension ? `${extension} files` : 'files without an extension');
}
