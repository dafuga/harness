import type { ComplexityCoverage } from '../../utils/complexityCoverage';
import { extname } from 'node:path';

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
