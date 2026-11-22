// @harness-uid u_pv45ayumau
import ts from 'typescript';
import type { ContractItem } from '../../../core/development-tooling/unitTypes';
import { parseParameters } from '../../../utils/development-tooling/parseParameters';
import { parameterDefault } from '../../../utils/development-tooling/parameterDefault';

/** Module scripts may export functions, but only the instance script declares props. */
export function instanceScript(code: string): string {
	return (
		[
			...code.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)
		].find((match) => !/\bmodule\b|\bcontext\s*=\s*['"]module['"]/.test(match[1]))?.[2] ?? ''
	);
}

export function componentSource(code: string): ts.SourceFile {
	const text = code.includes('<script') ? instanceScript(code) : code;
	return ts.createSourceFile('component.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Nested declarations and module scripts cannot contribute component inputs. */
export function propsDeclaration(file: ts.SourceFile): ts.VariableDeclaration | undefined {
	return file.statements
		.flatMap((statement) =>
			ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []
		)
		.find(
			(node) =>
				node.initializer &&
				ts.isCallExpression(node.initializer) &&
				node.initializer.expression.getText(file) === '$props'
		);
}

export function propsType(node: ts.VariableDeclaration): ts.TypeNode | undefined {
	return (
		node.type ??
		(node.initializer && ts.isCallExpression(node.initializer)
			? node.initializer.typeArguments?.[0]
			: undefined)
	);
}

export function localProps(
	type: ts.TypeNode | undefined,
	file: ts.SourceFile,
	seen: Set<string> = new Set<string>()
): ContractItem[] {
	if (!type) return [];
	if (ts.isParenthesizedTypeNode(type)) return localProps(type.type, file, seen);
	if (ts.isIntersectionTypeNode(type))
		return type.types.flatMap((part) => localProps(part, file, seen));
	if (ts.isTypeLiteralNode(type)) return propMembers(type.members);
	if (!ts.isTypeReferenceNode(type) || seen.has(type.typeName.getText(file))) return [];
	const name = type.typeName.getText(file);
	const next = new Set([...seen, name]);
	return namedProps(name, file, next);
}

function namedProps(name: string, file: ts.SourceFile, next: Set<string>): ContractItem[] {
	const declaration = file.statements.find(
		(node) =>
			(ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
			node.name.text === name
	);
	if (declaration && ts.isTypeAliasDeclaration(declaration))
		return localProps(declaration.type, file, next);
	return declaration && ts.isInterfaceDeclaration(declaration)
		? propMembers(declaration.members)
		: [];
}

export function propMembers(members: ts.NodeArray<ts.TypeElement>): ContractItem[] {
	return members.flatMap((member) => {
		if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) return [];
		const name = ts.isStringLiteralLike(member.name) ? member.name.text : member.name.getText();
		const type = member.type?.getText() ?? 'unknown';
		return [{ name, type, required: !member.questionToken }];
	});
}

export function boundProps(
	items: ContractItem[],
	node: ts.VariableDeclaration,
	owner: string
): ContractItem[] {
	const bindings = ts.isObjectBindingPattern(node.name) ? node.name.elements : [];
	return items.map((item) => {
		const binding = bindings.find(
			(entry) => (entry.propertyName?.getText() ?? entry.name.getText()) === item.name
		);
		const fallback = binding?.initializer ? bindableValue(binding.initializer) : undefined;
		const named = { ...item, name: `${owner}.${item.name}` };
		if (fallback) return { ...named, required: false, ...parameterDefault(fallback) };
		if (item.required === false) return { ...named, default: 'undefined (omitted)' };
		return named;
	});
}

/** Svelte's `$bindable(value)` marks a two-way prop; its argument is the prop's default. */
function bindableValue(node: ts.Expression): ts.Expression | undefined {
	if (!ts.isCallExpression(node) || node.expression.getText() !== '$bindable') return node;
	return node.arguments[0];
}

export function componentSnippets(code: string, owner: string) {
	const markup = code.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>/g, '');
	return [...markup.matchAll(/\{#snippet\s+([\w$]+)\s*\(([\s\S]*?)\)\s*\}/g)].map((match) => {
		const name = `${owner}.${match[1]}`;
		return {
			name,
			kind: 'snippet' as const,
			inputs: parseParameters(match[2], '', { owner: name }),
			output: 'markup'
		};
	});
}
