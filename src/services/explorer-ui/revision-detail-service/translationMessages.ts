import ts from 'typescript';
import type { TranslationRegistration, TranslationSource } from './translationMessages.types';

/** Flatten message objects while retaining empty strings and ICU expressions verbatim. */
export function flattenMessages(input: unknown, prefix = ''): Record<string, string> {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('Dictionary must be an object.');
	const result: Record<string, string> = Object.create(null);
	for (const [name, value] of Object.entries(input)) {
		const key = prefix ? `${prefix}.${name}` : name;
		if (typeof value === 'string') result[key] = value;
		else Object.assign(result, flattenMessages(value, key));
	}
	return result;
}

function literal(node: ts.Expression): unknown {
	if (ts.isStringLiteralLike(node)) return node.text;
	if (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node)
	)
		return literal(node.expression);
	if (!ts.isObjectLiteralExpression(node)) throw new Error('Dictionary is not a static object.');
	const entries = node.properties.map((property) => {
		if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
			throw new Error('Dictionary has a computed property or spread.');
		return [property.name.text, literal(property.initializer)];
	});
	return Object.fromEntries(entries);
}

function imports(source: ts.SourceFile) {
	const resources = new Map<string, string>();
	const registrars = new Set<string>();
	for (const statement of source.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
			continue;
		const module = statement.moduleSpecifier.text;
		const clause = statement.importClause;
		if (module.endsWith('.json') && clause?.name) resources.set(clause.name.text, module);
		if (module === 'svelte-i18n')
			for (const name of registrarNames(clause?.namedBindings)) registrars.add(name);
	}
	return { resources, registrars };
}

/** Only actual svelte-i18n registration imports are inspected; source is never evaluated. */
export function translationMessages(text: string): TranslationSource {
	const source = ts.createSourceFile('messages.ts', text, ts.ScriptTarget.Latest, true);
	const { resources, registrars } = imports(source);
	const registrations: TranslationRegistration[] = [];
	const constants = new Map<string, ts.Expression>();
	const gaps: string[] = [];
	function visit(node: ts.Node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
			constants.set(node.name.text, node.initializer);
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			registrars.has(node.expression.text)
		) {
			try {
				registrations.push(registration(node.arguments, resources, constants));
			} catch (error) {
				gaps.push(error instanceof Error ? error.message : 'Dictionary cannot be read.');
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	const keys = [...text.matchAll(/\$(?:t|_)\(\s*(['"`])([^'"`$]+)\1/g)].map((match) => match[2]);
	return { registrations, keys: [...new Set(keys)], gaps };
}

function registration(
	args: ts.NodeArray<ts.Expression>,
	resources: Map<string, string>,
	constants: Map<string, ts.Expression>
): TranslationRegistration {
	const [language, dictionary] = args;
	if (!language || !ts.isStringLiteralLike(language) || !dictionary)
		throw new Error('Dynamic locale or dictionary cannot be inspected statically.');
	const locale = language.text;
	if (ts.isIdentifier(dictionary)) {
		const resource = resources.get(dictionary.text);
		if (resource) return { locale, resource };
		const constant = constants.get(dictionary.text);
		if (constant) return { locale, messages: flattenMessages(literal(constant)) };
	}
	return { locale, messages: flattenMessages(literal(dictionary)) };
}

function registrarNames(bindings?: ts.NamedImportBindings): string[] {
	if (!bindings || !ts.isNamedImports(bindings)) return [];
	return bindings.elements
		.filter((binding) => (binding.propertyName ?? binding.name).text === 'addMessages')
		.map((binding) => binding.name.text);
}
