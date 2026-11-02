// @harness-uid u_oaixfe7pzs
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
