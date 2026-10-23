import ts from 'typescript';
import { basename } from 'node:path';
import type { PlannedFile } from '../../core/development-tooling/files';

/** @pure Put generated named types beside their implementation, keeping public type imports valid. */
export function separateTypeDeclarations(files: PlannedFile[]): PlannedFile[] {
	return files.flatMap((file) => {
		if (!file.path.endsWith('.ts') || file.path.endsWith('.d.ts')) return [file];
		const tree = ts.createSourceFile(file.path, file.contents, ts.ScriptTarget.Latest, true);
		const declarations = tree.statements.filter(
			(node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
		);
		const runtime = tree.statements.some(
			(node) =>
				ts.isClassDeclaration(node) ||
				ts.isFunctionDeclaration(node) ||
				ts.isVariableStatement(node)
		);
		if (!runtime || !declarations.length) return [file];
		const types = file.path.replace(/\.ts$/, '.types.ts');
		const specifier = './' + basename(types, '.ts');
		const names = declarations.map((node) => node.name.text).join(', ');
		let contents = file.contents;
		for (const node of [...declarations].reverse())
			contents = contents.slice(0, node.getFullStart()) + contents.slice(node.end);
		contents = withoutUnusedTypeImports(contents, file.path);
		return [
			{
				...file,
				contents: `import type { ${names} } from '${specifier}';\n\n${contents.trim()}\n\nexport type { ${names} } from '${specifier}';\n`
			},
			{
				path: types,
				contents:
					[
						typeImports(tree, declarations).trim(),
						declarations.map((node) => node.getFullText(tree).trim()).join('\n\n')
					]
						.filter(Boolean)
						.join('\n\n') + '\n'
			}
		];
	});
}

function referencedNames(nodes: readonly ts.Node[]): Set<string> {
	const names = new Set<string>();
	const visit = (node: ts.Node) => {
		if (ts.isIdentifier(node)) names.add(node.text);
		ts.forEachChild(node, visit);
	};
	for (const node of nodes) visit(node);
	return names;
}

function typeImports(tree: ts.SourceFile, declarations: ts.Node[]): string {
	const names = referencedNames(declarations);
	return (
		tree.statements
			.flatMap((node) => {
				if (!ts.isImportDeclaration(node) || !node.importClause) return [];
				const clause = node.importClause;
				const bindings = clause.namedBindings;
				const named = importedTypes(bindings, names);
				const defaultName = clause.name && names.has(clause.name.text) ? clause.name : undefined;
				if (!defaultName && (!named || (ts.isNamedImports(named) && !named.elements.length)))
					return [];
				const updated = ts.factory.updateImportDeclaration(
					node,
					node.modifiers,
					ts.factory.updateImportClause(clause, true, defaultName, named),
					node.moduleSpecifier,
					undefined
				);
				return [ts.createPrinter().printNode(ts.EmitHint.Unspecified, updated, tree)];
			})
			.join('\n') + '\n'
	);
}

function importedTypes(bindings: ts.NamedImportBindings | undefined, names: Set<string>) {
	if (!bindings) return undefined;
	if (ts.isNamespaceImport(bindings)) return names.has(bindings.name.text) ? bindings : undefined;
	return ts.factory.updateNamedImports(
		bindings,
		bindings.elements
			.filter((item) => names.has(item.name.text))
			.map((item) => ts.factory.updateImportSpecifier(item, false, item.propertyName, item.name))
	);
}

function withoutUnusedTypeImports(contents: string, path: string): string {
	const tree = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true);
	const names = referencedNames(tree.statements.filter((node) => !ts.isImportDeclaration(node)));
	for (const node of [...tree.statements].reverse()) {
		if (!ts.isImportDeclaration(node) || !node.importClause) continue;
		const clause = node.importClause;
		const bindings = clause.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) continue;
		const kept = bindings.elements.filter(
			(item) => !(clause.isTypeOnly || item.isTypeOnly) || names.has(item.name.text)
		);
		const updated = ts.factory.updateImportDeclaration(
			node,
			node.modifiers,
			ts.factory.updateImportClause(
				clause,
				clause.isTypeOnly,
				clause.name,
				ts.factory.updateNamedImports(bindings, kept)
			),
			node.moduleSpecifier,
			node.attributes
		);
		const text =
			!clause.name && !kept.length && clause.isTypeOnly
				? ''
				: ts.createPrinter().printNode(ts.EmitHint.Unspecified, updated, tree);
		contents = contents.slice(0, node.getStart(tree)) + text + contents.slice(node.end);
	}
	return contents;
}
