export function svelteScripts(code: string): string[] {
	return [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

export { scanImports } from '../../services/development-tooling/source-index-service/scanImports';

export type { ReferenceVia, SourceLanguage, SourceReference } from './scanImports.types';
