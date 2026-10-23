import ts from 'typescript';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';

const bootstrap = new Set([
	'function.unit-types',
	'function.verify-types',
	'function.comparison-types'
]);

/** A data initialization sample cannot stand in for executing an exported callable. */
export function initializationEdits(file: ts.SourceFile, unit: ComponentManifest, watch: string) {
	if (bootstrap.has(unit.id) || unit.helperContracts?.length) return [];
	if (file.statements.some(hasCallable)) return [];
	const declarations = file.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) =>
			[...statement.declarationList.declarations].filter((item) => item.initializer)
		);
	if (
		!declarations.length ||
		!declarations.every((item) => dataInitializer(item.initializer!, unit))
	)
		return [];
	const source = unit.owns.source.find((path) => file.fileName.endsWith(`/${path}`));
	if (!source) return [];
	const metadata = JSON.stringify({
		unit: unit.id,
		operation: `initialize:${source}`,
		asynchronous: false
	});
	const start = file.text.startsWith('#!') ? file.text.indexOf('\n') + 1 : 0;
	return [
		{ start, end: start, text: `\nconst ${watch}Finish = ${watch}Begin(${metadata});\n` },
		{ start: file.text.length, end: file.text.length, text: `\n${watch}Finish();\n` }
	];
}

function hasCallable(node: ts.Node): boolean {
	if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return true;
	if (ts.isFunctionLike(node) && 'body' in node && node.body) return true;
	return ts.forEachChild(node, hasCallable) === true;
}

function dataInitializer(expression: ts.Expression, unit: ComponentManifest): boolean {
	const value = unwrapped(expression);
	if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return false;
	if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) return false;
	if (
		ts.isObjectLiteralExpression(value) ||
		ts.isArrayLiteralExpression(value) ||
		dataConstructor(value)
	)
		return literalData(value);
	return ['model', 'config'].includes(unit.kind) || literalData(value);
}

function literalData(expression: ts.Expression): boolean {
	const value = unwrapped(expression);
	if (ts.isObjectLiteralExpression(value))
		return value.properties.every(
			(property) => ts.isPropertyAssignment(property) && literalData(property.initializer)
		);
	if (ts.isArrayLiteralExpression(value)) return value.elements.every(literalData);
	if (dataConstructor(value)) return (value.arguments ?? []).every(literalData);
	return (
		ts.isLiteralExpression(value) ||
		[ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
			value.kind
		)
	);
}

function dataConstructor(value: ts.Expression): value is ts.NewExpression {
	return (
		ts.isNewExpression(value) &&
		ts.isIdentifier(value.expression) &&
		['Map', 'Set', 'RegExp', 'Date', 'URL'].includes(value.expression.text)
	);
}

function unwrapped(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isNonNullExpression(current)
	)
		current = current.expression;
	return current;
}
