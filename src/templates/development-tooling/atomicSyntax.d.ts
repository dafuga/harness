import type { AST } from 'svelte/compiler';
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
	node: unknown,
	callback: (node: Record<string, unknown>) => void
): void;
