import { atomicSyntax } from '../../templates/development-tooling/atomicSyntax.js';
import type { AuditFile } from './adapters/types';
import type { AuditFinding } from './types';

/** Enforce source composition before a native atom is inlined by the Svelte preprocessor. */
export function auditAtomicComposition(file: AuditFile): AuditFinding[] {
	if (!/^src\/(?:components|routes)\//.test(file.relativePath)) return [];
	let syntax;
	try {
		syntax = atomicSyntax(file.contents);
	} catch {
		return [];
	}
	const tier = syntax.tier;
	const findings: AuditFinding[] = [];
	const report = (rule: string, message: string) =>
		findings.push({ path: file.relativePath, rule, message });
	if (!tier)
		report('atomic-tier-required', 'Declare the component composition level with @harness-tier.');
	for (const atom of syntax.atoms) {
		if (!atom.definition)
			report('atomic-unknown-element', `Unknown native atom ${atom.node.name}.`);
		if (!syntax.directory)
			report('atomic-definition-required', 'Declare the canonical @harness-atoms directory.');
	}
	walkMarkup(syntax.tree.fragment, (node) => {
		if (tier === 'atom' && node.type === 'Component')
			report('atomic-atom-composition', 'Atoms contain native elements, not composed components.');
		if (
			tier !== 'atom' &&
			['RegularElement', 'SvelteElement'].includes(String(node.type)) &&
			!String(node.name).startsWith('hx-')
		)
			report(
				'atomic-native-element',
				`Use the shared atom for ${String(node.name ?? 'svelte:element')}.`
			);
	});
	return findings;
}

function walkMarkup(node: unknown, visit: (node: Record<string, unknown>) => void): void {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node) walkMarkup(child, visit);
		return;
	}
	const record = node as Record<string, unknown>;
	if (record.type) visit(record);
	for (const [key, child] of Object.entries(record))
		if (!['metadata', 'parent', 'expression', 'attributes'].includes(key)) walkMarkup(child, visit);
}
