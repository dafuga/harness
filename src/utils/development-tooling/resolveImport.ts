import { resolveHttpEndpoint } from './resolve-import/resolveHttpEndpoint';
import type { ResolveContext } from './resolveImport.types';
import { posix } from 'node:path';
import type { ResolvedReference } from '../../core/development-tooling/sourceTypes';
import type { SourceReference } from './scanImports';

const suffixes = ['', '.ts', '.tsx', '.js', '.mjs', '.svelte', '.svelte.ts', '.json', '.css'];
const indexes = ['/index.ts', '/index.js', '/index.svelte'];
const frameworkModules = /^\$(?:app|env|service-worker)\b/;

/** Resolves one scanned reference to a tracked file, an external module, or an uncertainty. */
export function resolveImport(
	from: string,
	reference: SourceReference,
	context: ResolveContext
): ResolvedReference {
	if (reference.via === 'http') return resolveHttpEndpoint(reference, context);
	const base = { via: reference.via, typeOnly: reference.typeOnly };
	const specifier = reference.specifier;
	if (specifier === null) {
		return { ...base, uncertain: { reason: 'non-literal-import', detail: reference.detail ?? '' } };
	}
	if (specifier.endsWith('/$types') || frameworkModules.test(specifier)) {
		return { ...base, external: 'sveltekit' };
	}
	const target = targetPath(from, reference, context);
	if (target === undefined) return { ...base, external: packageName(specifier) };
	const path = existing(target, context.files);
	if (path) return { ...base, path };
	if (reference.via === 'style-import' && !specifier.startsWith('.')) {
		return { ...base, external: packageName(specifier) };
	}
	return { ...base, uncertain: { reason: 'unresolved-import', detail: specifier } };
}

function targetPath(
	from: string,
	reference: SourceReference,
	context: ResolveContext
): string | undefined {
	const specifier = reference.specifier ?? '';
	if (specifier.startsWith('$lib/')) {
		return posix.join(context.workspaceRoot, 'src/lib', specifier.slice(5));
	}
	const relative = specifier.startsWith('.') || reference.via === 'style-import';
	if (!relative) return undefined;
	return posix.normalize(posix.join(posix.dirname(from), specifier));
}

function existing(target: string, files: ReadonlySet<string>): string | undefined {
	const candidates = [
		...suffixes.map((suffix) => `${target}${suffix}`),
		...indexes.map((index) => `${target}${index}`),
		target.replace(/\.js$/, '.ts')
	];
	return candidates.find((candidate) => files.has(candidate));
}

function packageName(specifier: string): string {
	if (specifier.startsWith('node:') || specifier.startsWith('bun:')) return specifier;
	const parts = specifier.split('/');
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export type { ResolveContext } from './resolveImport.types';
