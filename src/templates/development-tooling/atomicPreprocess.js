import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import MagicString from 'magic-string';
import { parse } from 'svelte/compiler';
import { nativeAtoms, nativeAtomSource } from './htmlElements.js';
import { atomicSyntax } from './atomicSyntax.js';

/** Inline native atoms before Svelte validation so native bindings, CSS and semantics survive. */
export function atomicComponents(options = {}) {
	return {
		name: 'harness-atomic-components',
		markup({ content, filename }) {
			if (!filename || (!content.includes('/atoms/') && !content.includes('<hx-'))) return;
			const syntax = atomicSyntax(content);
			const tree = syntax.tree;
			const code = new MagicString(content);
			const imports = atomImports(tree, filename, options.aliases ?? {});
			const atoms = new Map(imports.map((entry) => [entry.name, entry.atom]));
			for (const { node, definition } of syntax.atoms) {
				if (!definition) throw new Error(`Unknown native atom ${node.name}.`);
				if (atoms.has(node.name)) continue;
				if (!syntax.directory) throw new Error(`Declare @harness-atoms in ${filename}.`);
				const path = resolve(dirname(filename), syntax.directory, definition.name + '.svelte');
				const source = readFileSync(path, 'utf8');
				if (!sameDefinition(source, definition))
					throw new Error(`Native atom ${path} does not match its element contract.`);
				atoms.set(node.name, definition);
				imports.push({ path });
			}
			for (const entry of imports)
				if (entry.start !== undefined) code.remove(entry.start, entry.end);
			visit(tree.fragment, (node) => inlineAtom(node, atoms, content, code));
			return {
				code: code.toString(),
				map: code.generateMap({ hires: true, source: filename }),
				dependencies: [...new Set(imports.map((entry) => entry.path))]
			};
		}
	};
}

function atomImports(tree, filename, aliases) {
	const statements = [...(tree.instance?.content.body ?? []), ...(tree.module?.content.body ?? [])];
	return statements.flatMap((node) => {
		if (node.type !== 'ImportDeclaration' || node.importKind === 'type') return [];
		const specifier = node.source.value;
		const match = /\/atoms\/([^/]+)\.svelte$/.exec(specifier);
		if (!match) return [];
		const atom = nativeAtoms.find((candidate) => candidate.name === match[1]);
		if (!atom) return [];
		const binding = node.specifiers.find((entry) => entry.type === 'ImportDefaultSpecifier');
		if (!binding || node.specifiers.length !== 1) return [];
		const path = atomImportPath(specifier, filename, aliases);
		if (!path) throw new Error(`Cannot resolve native atom ${specifier}; configure its alias.`);
		const source = readFileSync(path, 'utf8');
		if (!sameDefinition(source, atom))
			throw new Error(`Native atom ${path} must retain its element contract and have no styles.`);
		return [{ name: binding.local.name, atom, path, start: node.start, end: node.end }];
	});
}

function atomImportPath(specifier, filename, aliases) {
	if (specifier.startsWith('.')) return resolve(dirname(filename), specifier);
	const prefix = Object.keys(aliases).find((key) => specifier.startsWith(key + '/'));
	return prefix ? resolve(aliases[prefix], specifier.slice(prefix.length + 1)) : undefined;
}

function sameDefinition(source, atom) {
	try {
		return (
			JSON.stringify(definitionTree(parse(source, { modern: true }))) ===
			JSON.stringify(definitionTree(parse(nativeAtomSource(atom), { modern: true })))
		);
	} catch {
		return false;
	}
}

/** Ignore formatting and source positions, retaining all actual declarations and literal values. */
function definitionTree(node) {
	if (!node || typeof node !== 'object') return node;
	if (Array.isArray(node)) return node.map(definitionTree).filter((entry) => entry !== undefined);
	if (node.type === 'Text' && !node.data.trim()) return undefined;
	return Object.fromEntries(
		Object.entries(node)
			.filter(
				([key]) =>
					![
						'start',
						'end',
						'loc',
						'raw',
						'metadata',
						'comments',
						'leadingComments',
						'trailingComments'
					].includes(key)
			)
			.map(([key, child]) => [key, definitionTree(child)])
	);
}

function inlineAtom(node, atoms, content, code) {
	if (!['Component', 'RegularElement'].includes(node.type) || !atoms.has(node.name)) return;
	const atom = atoms.get(node.name);
	code.overwrite(node.start + 1, node.start + 1 + node.name.length, atom.tag);
	const closing = content.lastIndexOf('</' + node.name, node.end - 1);
	if (closing > node.start) code.overwrite(closing + 2, closing + 2 + node.name.length, atom.tag);
	if (atom.type) code.appendLeft(node.start + 1 + node.name.length, ` type="${atom.type}"`);
}

function visit(node, callback) {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node) visit(child, callback);
		return;
	}
	if (node.type) callback(node);
	for (const [key, child] of Object.entries(node))
		if (!['parent', 'metadata'].includes(key)) visit(child, callback);
}
