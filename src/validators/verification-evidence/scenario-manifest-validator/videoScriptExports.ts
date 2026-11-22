// @harness-uid u_hfud4vng54
import ts from 'typescript';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

/** Inspect direct callable exports without importing or running the recording module. */
export function videoScriptExports(path: string, code: string): Set<string> {
	const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
	if (
		(source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics
			.length
	)
		throw new ExpectedCliError(`Invalid video recording script syntax: ${path}`);
	const locals = new Set(source.statements.flatMap(callableNames));
	const exports = new Set<string>();
	for (const statement of source.statements) {
		for (const name of declaredExports(statement, locals)) exports.add(name);
		for (const name of namedExports(statement, locals)) exports.add(name);
	}
	return exports;
}

function callableNames(node: ts.Statement): string[] {
	if (ts.isFunctionDeclaration(node)) return node.name && node.body ? [node.name.text] : [];
	if (!ts.isVariableStatement(node)) return [];
	return node.declarationList.declarations.flatMap((item) =>
		ts.isIdentifier(item.name) &&
		item.initializer &&
		(ts.isArrowFunction(item.initializer) || ts.isFunctionExpression(item.initializer))
			? [item.name.text]
			: []
	);
}

function modifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	return Boolean(
		ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((item) => item.kind === kind)
	);
}

function callableDefault(node: ts.Expression, locals: Set<string>): boolean {
	return (
		ts.isArrowFunction(node) ||
		ts.isFunctionExpression(node) ||
		(ts.isIdentifier(node) && locals.has(node.text))
	);
}

function declaredExports(node: ts.Statement, locals: Set<string>): string[] {
	if (ts.isExportAssignment(node))
		return !node.isExportEquals && callableDefault(node.expression, locals) ? ['default'] : [];
	if (!modifier(node, ts.SyntaxKind.ExportKeyword)) return [];
	if (ts.isFunctionDeclaration(node) && node.body && modifier(node, ts.SyntaxKind.DefaultKeyword))
		return ['default'];
	return callableNames(node);
}

function namedExports(node: ts.Statement, locals: Set<string>): string[] {
	if (
		!ts.isExportDeclaration(node) ||
		node.isTypeOnly ||
		node.moduleSpecifier ||
		!node.exportClause ||
		!ts.isNamedExports(node.exportClause)
	)
		return [];
	return node.exportClause.elements
		.filter((item) => !item.isTypeOnly && locals.has((item.propertyName ?? item.name).text))
		.map((item) => item.name.text);
}
