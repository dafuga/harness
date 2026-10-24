import { posix } from 'node:path';
import type { SourceReference } from '../scanImports';
import type { ResolveContext } from '../resolveImport.types';
import type { ResolvedReference } from '../../../core/development-tooling/sourceTypes';

/** Match an explicit same-app request against only the owning workspace's tracked endpoints. */
export function resolveHttpEndpoint(
	reference: SourceReference,
	context: ResolveContext
): ResolvedReference {
	const base = { via: reference.via, typeOnly: false };
	const specifier = reference.specifier;
	if (specifier === null)
		return { ...base, uncertain: { reason: 'non-literal-import', detail: reference.detail ?? '' } };
	if (/^(?:https?:)?\/\//i.test(specifier)) return { ...base, external: specifier };
	const path = specifier.split(/[?#]/)[0];
	const root = posix.join(context.workspaceRoot, 'src/routes') + '/';
	const candidates = [...context.files].filter(
		(file) => file.startsWith(root) && /\/\+server\.[cm]?[jt]s$/.test(file)
	);
	const matched = path.startsWith('/')
		? candidates
				.filter((file) => routeMatches(file.slice(root.length), path))
				.sort((a, b) => specificity(b) - specificity(a))
		: [];
	if (matched.length && (matched.length === 1 || specificity(matched[0]) > specificity(matched[1])))
		return { ...base, path: matched[0] };
	return { ...base, uncertain: { reason: 'unresolved-import', detail: specifier } };
}

function routeMatches(source: string, path: string): boolean {
	const route = source
		.split('/')
		.slice(0, -1)
		.filter((part) => !/^\(.+\)$/.test(part));
	const requested = path.split('/').filter(Boolean);
	if (route.length !== requested.length) return false;
	return route.every((part, at) => {
		if (
			part.startsWith('[') &&
			part.endsWith(']') &&
			!part.includes('...') &&
			!part.startsWith('[[')
		)
			return true;
		return !requested[at].includes('${}') && part === requested[at];
	});
}

/** Literal routes take precedence over a same-length parameter route. */
function specificity(path: string): number {
	return path.split('/').filter((part) => !part.startsWith('[') && !part.startsWith('(')).length;
}
