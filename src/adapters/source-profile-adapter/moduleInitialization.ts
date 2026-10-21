import ts from 'typescript';
import type { ComponentManifest } from '../../core/unitTypes';

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

function hasCallable(statement: ts.Statement): boolean {
	if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) return true;
	if (!ts.isVariableStatement(statement)) return false;
	return statement.declarationList.declarations.some((item) => {
		if (!item.initializer) return false;
		const value = unwrapped(item.initializer);
		return ts.isArrowFunction(value) || ts.isFunctionExpression(value);
	});
}

function dataInitializer(expression: ts.Expression, unit: ComponentManifest): boolean {
	const value = unwrapped(expression);
	if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return false;
	if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) return false;
	if (['model', 'config'].includes(unit.kind)) return true;
	if (literalData(value)) return true;
	return (
		ts.isNewExpression(value) &&
		ts.isIdentifier(value.expression) &&
		['Map', 'Set', 'RegExp', 'Date', 'URL'].includes(value.expression.text)
	);
}

function literalData(value: ts.Expression): boolean {
	return (
		ts.isLiteralExpression(value) ||
		ts.isObjectLiteralExpression(value) ||
		ts.isArrayLiteralExpression(value) ||
		[ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
			value.kind
		)
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
