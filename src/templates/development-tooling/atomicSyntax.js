import { parse } from 'svelte/compiler';
import { atomTag, nativeAtoms } from './htmlElements.js';

/** Source facts shared by compilation, audit and dependency indexing. */
export function atomicSyntax(content) {
	const tree = parse(content, { modern: true });
	const comments = tree.fragment.nodes.filter((node) => node.type === 'Comment');
	const directory = comments
		.map((node) => /^\s*@harness-atoms\s+(\S+)\s*$/.exec(node.data)?.[1])
		.find(Boolean);
	const tier = comments
		.map(
			(node) => /^\s*@harness-tier\s+(atom|molecule|organism|layout|page)\s*$/.exec(node.data)?.[1]
		)
		.find(Boolean);
	const element = comments
		.map((node) => /^\s*@harness-element\s+(\S+)(?:\s+\S+)?\s*$/.exec(node.data)?.[1])
		.find(Boolean);
	const atoms = [];
	walkAtomicMarkup(tree.fragment, (node) => {
		if (node.type !== 'RegularElement' || !node.name.startsWith('hx-')) return;
		const definition = nativeAtoms.find((atom) => atomTag(atom) === node.name);
		atoms.push({ node, definition });
	});
	return { tree, directory, tier, element, atoms };
}

export function walkAtomicMarkup(node, callback) {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node) walkAtomicMarkup(child, callback);
		return;
	}
	if (node.type) callback(node);
	for (const [key, child] of Object.entries(node))
		if (!['parent', 'metadata', 'expression', 'attributes'].includes(key))
			walkAtomicMarkup(child, callback);
}
