export type ReferenceVia =
	| 'import'
	| 'reexport'
	| 'dynamic-import'
	| 'require'
	| 'url'
	| 'style-import';

export type SourceLanguage = 'ts' | 'svelte' | 'css' | 'other';

export interface SourceReference {
	/** Null when the reference is not a string literal and cannot be resolved statically. */
	specifier: string | null;
	via: ReferenceVia;
	typeOnly: boolean;
	detail?: string;
}

export function svelteScripts(code: string): string[] {
	return [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

export { scanImports } from '../services/source-index-service/scanImports';
