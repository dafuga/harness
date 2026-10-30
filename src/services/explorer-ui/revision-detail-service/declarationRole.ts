import type { DeclarationRole } from './declarationRole.types';

/** Classify source facts independently of immutable unit IDs and directory-derived kinds. */
export function declarationRole(kind: string, stored = false): DeclarationRole {
	if (kind === 'type' || kind === 'interface') return 'type';
	if (kind === 'class' && stored) return 'persisted-model';
	if (kind === 'reexport') return 'compatibility';
	if (['function', 'method', 'component', 'snippet'].includes(kind)) return 'operation';
	return 'runtime-support';
}
