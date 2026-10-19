import { createHash } from 'node:crypto';
import ts from 'typescript';
import { helperScopes } from './helperScopes';
import { helperTemplates } from './helperTemplates';

export interface HelperBinding {
	specifier?: string;
	imported: string;
}
export interface HelperReference extends HelperBinding {
	caller: string | null;
}
export interface HelperFacts {
	references: HelperReference[];
	forwards: Array<HelperBinding & { name: string }>;
}
const cache = new Map<string, HelperFacts>();

function imports(source: ts.SourceFile): Map<string, HelperBinding> {
	const found = new Map<string, HelperBinding>();
	for (const node of source.statements) {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
		const clause = node.importClause;
		if (!clause || clause.isTypeOnly) continue;
		const specifier = node.moduleSpecifier.text;
		if (clause.name) found.set(clause.name.text, { specifier, imported: 'default' });
		const bindings = clause.namedBindings;
		if (bindings && ts.isNamespaceImport(bindings))
			found.set(bindings.name.text, { specifier, imported: '*' });
		if (bindings && ts.isNamedImports(bindings))
			for (const item of bindings.elements) {
				if (!item.isTypeOnly)
					found.set(item.name.text, {
						specifier,
						imported: item.propertyName?.text ?? item.name.text
					});
			}
	}
	return found;
}

function forwards(source: ts.SourceFile): HelperFacts['forwards'] {
	return source.statements.flatMap((node) => {
		if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
			const specifier =
				node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
					? node.moduleSpecifier.text
					: undefined;
			if (!node.exportClause) return [{ name: '*', imported: '*', specifier }];
			if (!ts.isNamedExports(node.exportClause)) return [];
			return node.exportClause.elements
				.filter((item) => !item.isTypeOnly)
				.map((item) => ({
					name: item.name.text,
					imported: item.propertyName?.text ?? item.name.text,
					specifier
				}));
		}
		if (
			ts.isFunctionDeclaration(node) &&
			node.name &&
			node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
		) {
			return [{ name: 'default', imported: node.name.text }];
		}
		return [];
	});
}

function reference(node: ts.Node, bindings: Map<string, HelperBinding>): HelperReference | null {
	if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
		const binding = bindings.get(node.expression.text);
		const scope = helperScopes(node, node.expression.text);
		return binding?.imported === '*' && !scope.shadowed
			? { ...binding, imported: node.name.text, caller: scope.caller }
			: null;
	}
	if (
		ts.isElementAccessExpression(node) &&
		ts.isIdentifier(node.expression) &&
		ts.isStringLiteral(node.argumentExpression)
	) {
		const binding = bindings.get(node.expression.text);
		const scope = helperScopes(node, node.expression.text);
		return binding?.imported === '*' && !scope.shadowed
			? { ...binding, imported: node.argumentExpression.text, caller: scope.caller }
			: null;
	}
	if (!ts.isIdentifier(node)) return null;
	const parent = node.parent;
	if ('name' in parent && parent.name === node && !ts.isShorthandPropertyAssignment(parent))
		return null;
	const scope = helperScopes(node, node.text);
	const binding = bindings.get(node.text) ?? { imported: node.text };
	return scope.shadowed || binding.imported === '*' ? null : { ...binding, caller: scope.caller };
}

function collect(source: ts.SourceFile): HelperReference[] {
	const bindings = imports(source),
		found: HelperReference[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
		const used = reference(node, bindings);
		if (used) found.push(used);
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

/** Source facts contain only names and references, so cached ASTs cannot retain whole trees. */
export function helperReferences(code: string, svelte = false): HelperFacts {
	const key = createHash('sha256').update(`${svelte}\0${code}`).digest('hex');
	const known = cache.get(key);
	if (known) return known;
	const source = ts.createSourceFile(
		'helpers.ts',
		svelte ? helperTemplates(code) : code,
		ts.ScriptTarget.Latest,
		true
	);
	const facts = { references: collect(source), forwards: forwards(source) };
	if (cache.size >= 4096) cache.delete(cache.keys().next().value!);
	cache.set(key, facts);
	return facts;
}
