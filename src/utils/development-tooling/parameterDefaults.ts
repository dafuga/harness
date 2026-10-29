import ts from 'typescript';
import type { ContractItem } from '../../core/development-tooling/unitTypes';

/** Decode literal syntax only; default expressions never run during indexing. */
export function parameterDefault(node: ts.Expression | undefined): Pick<ContractItem, 'default'> {
	if (!node) return {};
	if (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node)
	)
		return parameterDefault(node.expression);
	if (ts.isStringLiteralLike(node)) return { default: node.text };
	if (node.kind === ts.SyntaxKind.TrueKeyword) return { default: true };
	if (node.kind === ts.SyntaxKind.FalseKeyword) return { default: false };
	if (node.kind === ts.SyntaxKind.NullKeyword) return { default: null };
	if (ts.isNumericLiteral(node)) return { default: Number(node.text) };
	if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
		if (node.operator === ts.SyntaxKind.MinusToken) return { default: -Number(node.operand.text) };
		if (node.operator === ts.SyntaxKind.PlusToken) return { default: Number(node.operand.text) };
	}
	if (ts.isArrayLiteralExpression(node)) {
		const values = node.elements.map((item) => parameterDefault(item as ts.Expression));
		return values.every((item) => Object.hasOwn(item, 'default'))
			? { default: values.map((item) => item.default!) }
			: {};
	}
	if (!ts.isObjectLiteralExpression(node)) return {};
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
