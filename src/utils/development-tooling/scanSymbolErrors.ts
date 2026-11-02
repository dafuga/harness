// @harness-uid u_vkx5vqjo6s
import ts from 'typescript';
import type { ExportedSymbol } from '../../core/development-tooling/sourceTypes';

/** Bind observed throws to their declaration; indirect calls remain explicitly uncertain. */
export function scanSymbolErrors(code: string, symbols: ExportedSymbol[]): ExportedSymbol[] {
	const file = ts.createSourceFile('exports.ts', code, ts.ScriptTarget.Latest, true);
	const declarations = errorDeclarations(file);
	return symbols.map((symbol) => {
		const node = declarations.get(symbol.name);
		return node ? { ...symbol, ...errorsIn(node) } : symbol;
	});
}

function errorDeclarations(file: ts.SourceFile): Map<string, ts.Node> {
	const nodes = new Map<string, ts.Node>();
	for (const statement of file.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
			nodes.set(statement.name.text, statement.body);
		if (ts.isVariableStatement(statement)) variableBodies(statement, nodes);
		if (ts.isClassDeclaration(statement) && statement.name) methodBodies(statement, nodes);
	}
	return nodes;
}

function variableBodies(statement: ts.VariableStatement, nodes: Map<string, ts.Node>): void {
	for (const declaration of statement.declarationList.declarations) {
		const node = declaration.initializer;
		if (node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)))
			nodes.set(declaration.name.getText(), node.body);
	}
}

function methodBodies(statement: ts.ClassDeclaration, nodes: Map<string, ts.Node>): void {
	for (const member of statement.members) {
		if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body)
			nodes.set(
				`${statement.name!.text}.${ts.isConstructorDeclaration(member) ? 'constructor' : member.name.getText()}`,
				member.body
			);
	}
}

function errorsIn(root: ts.Node): Pick<ExportedSymbol, 'errors' | 'errorStatus'> {
	const errors = new Set<string>();
	let unknown = false;
	const visit = (node: ts.Node): void => {
		if (node !== root && ts.isFunctionLike(node)) return;
		unknown = observeError(node, errors) || unknown;
		ts.forEachChild(node, visit);
	};
	visit(root);
	if (unknown) return { errors: [...errors].sort(), errorStatus: 'unknown' };
	return { errors: [...errors].sort(), errorStatus: errors.size ? 'found' : 'none-found' };
}

function observeError(node: ts.Node, errors: Set<string>): boolean {
	if (ts.isThrowStatement(node)) {
		if (!node.expression || !ts.isNewExpression(node.expression)) return true;
		errors.add(node.expression.expression.getText());
	}
	if (!ts.isCallExpression(node)) return false;
	const name = node.expression.getText();
	if (name === 'fail') {
		errors.add('ExpectedCliError');
		return false;
	}
	const status = node.arguments[0];
	// Both SvelteKit helpers throw a typed error with their literal status.
	if (['error', 'redirect'].includes(name) && status && ts.isNumericLiteral(status)) {
		errors.add(`${name === 'error' ? 'HttpError' : 'Redirect'} ${status.text}`);
		return false;
	}
	return true;
}
