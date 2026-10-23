import { extname } from 'node:path';

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

/** The language of a file whose decision points are not counted, as a reader would name it. */
export function uncountedLanguage(path: string): string {
	const extension = extname(path).toLowerCase();
	return named[extension] ?? (extension ? `${extension} files` : 'files without an extension');
}

export { complexityCoverage } from '../../services/development-tooling/source-index-service/complexityCoverage';

export type { ComplexityCoverage } from './complexityCoverage.types';
