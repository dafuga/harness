// @harness-uid u_oaixfe7pzs
import ts from 'typescript';
import type { ContractItem } from '../../core/development-tooling/unitTypes';

/** Without a type checker, any possible binding in this source makes bare undefined ambiguous. */
export function sourceAllowsUndefined(code: string): boolean {
	if (!code.includes('undefined') && !code.includes('\\')) return true;
	const file = ts.createSourceFile('defaults.ts', code, ts.ScriptTarget.Latest, true);
	function shadowed(node: ts.Node): true | undefined {
		if (ts.isWithStatement(node)) return true;
		if (
			ts.isIdentifier(node) &&
			node.text === 'undefined' &&
			(node.parent as ts.NamedDeclaration).name === node
		)
			return true;
		return ts.forEachChild(node, shadowed);
	}
	return !ts.forEachChild(file, shadowed);
}

export function inputDefault(
	node: ts.Expression | undefined,
	omitted: boolean,
	allowBareUndefined: boolean
): Pick<ContractItem, 'default' | 'defaultKind'> {
	if (!node) return omitted ? { defaultKind: 'omitted' } : {};
	const value = unwrapDefault(node);
	if (allowBareUndefined && ts.isIdentifier(value) && value.text === 'undefined')
		return { defaultKind: 'undefined' };
	if (ts.isVoidExpression(value)) {
		const operand = unwrapDefault(value.expression);
		if (ts.isNumericLiteral(operand) && Number(operand.text) === 0)
			return { defaultKind: 'undefined' };
	}
	return parameterDefault(value);
}

function unwrapDefault(node: ts.Expression): ts.Expression {
	if (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node)
	)
		return unwrapDefault(node.expression);
	return node;
}

/** Decode literal syntax only; default expressions never run during indexing. */
export function parameterDefault(node: ts.Expression | undefined): Pick<ContractItem, 'default'> {
	if (!node) return {};
	node = unwrapDefault(node);
	const primitive = primitiveDefault(node);
	if (primitive) return primitive;
	if (ts.isArrayLiteralExpression(node)) {
		const items = node.elements.map((item) => parameterDefault(item));
		return items.every((item) => Object.hasOwn(item, 'default'))
			? { default: items.map((item) => item.default!) }
			: {};
	}
	return ts.isObjectLiteralExpression(node) ? objectDefault(node) : {};
}

function primitiveDefault(node: ts.Expression): Pick<ContractItem, 'default'> | undefined {
	if (ts.isStringLiteralLike(node)) return { default: node.text };
	if (node.kind === ts.SyntaxKind.TrueKeyword) return { default: true };
	if (node.kind === ts.SyntaxKind.FalseKeyword) return { default: false };
	if (node.kind === ts.SyntaxKind.NullKeyword) return { default: null };
	if (ts.isNumericLiteral(node)) return { default: Number(node.text) };
	if (!ts.isPrefixUnaryExpression(node) || !ts.isNumericLiteral(node.operand)) return undefined;
	if (node.operator === ts.SyntaxKind.MinusToken) return { default: -Number(node.operand.text) };
	if (node.operator === ts.SyntaxKind.PlusToken) return { default: Number(node.operand.text) };
	return undefined;
}

function objectDefault(node: ts.ObjectLiteralExpression): Pick<ContractItem, 'default'> {
	const entries: Array<[string, NonNullable<ContractItem['default']> | null]> = [];
	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return {};
		const value = parameterDefault(property.initializer);
		if (!Object.hasOwn(value, 'default')) return {};
		entries.push([
			ts.isStringLiteralLike(property.name) ? property.name.text : property.name.getText(),
			value.default!
		]);
	}
	return { default: Object.fromEntries(entries) };
}

export function parameterType(node: ts.Expression | undefined): string {
	const value = parameterDefault(node);
	if (!Object.hasOwn(value, 'default')) return 'unknown';
	if (value.default === null) return 'null';
	if (Array.isArray(value.default)) return 'unknown[]';
	return typeof value.default === 'object' ? 'object' : typeof value.default;
}
