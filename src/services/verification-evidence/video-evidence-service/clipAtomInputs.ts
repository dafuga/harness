// @harness-uid u_nfctcgnv7g
import { atomicSyntax } from '../../../templates/development-tooling/atomicSyntax.js';
import type { SourceReference } from '../../../utils/development-tooling/scanImports.types';

/** The native atom preprocessor resolves its declared directory relative to the component. */
export function clipAtomInputs(code: string, references: SourceReference[]): SourceReference[] {
	if (!code.includes('<hx-')) return references;
	let syntax;
	try {
		syntax = atomicSyntax(code);
	} catch {
		return references;
	}
	if (!syntax.directory) return references;
	const count = new Set(syntax.atoms.flatMap((atom) => atom.definition?.name ?? [])).size;
	return references.map((reference, index) => {
		if (index < references.length - count || reference.specifier?.startsWith('.')) return reference;
		return { ...reference, specifier: `./${reference.specifier}` };
	});
}
