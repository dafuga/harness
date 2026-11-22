// @harness-uid u_gdranbq6zx
import type { AST } from 'svelte/compiler';
type AtomicMarkupNode = {
	[key: string]: string | number | boolean | object | null | undefined;
	type: string;
};
export function atomicSyntax(content: string): {
	tree: AST.Root;
	directory?: string;
	tier?: string;
	element?: string;
	atoms: Array<{
		node: AST.RegularElement;
		definition?: { name: string; tag: string; type?: string };
	}>;
};
export function walkAtomicMarkup(
	node: AST.Fragment,
	callback: (node: AtomicMarkupNode) => void
): void;
