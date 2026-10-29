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
		if (ts.isVariableStatement(statement))
			for (const declaration of statement.declarationList.declarations) {
				const node = declaration.initializer;
				if (node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)))
					nodes.set(declaration.name.getText(), node.body);
			}
		if (!ts.isClassDeclaration(statement) || !statement.name) continue;
		for (const member of statement.members) {
			if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body)
				nodes.set(
					`${statement.name.text}.${ts.isConstructorDeclaration(member) ? 'constructor' : member.name.getText()}`,
					member.body
				);
		}
	}
	return nodes;
}

function errorsIn(root: ts.Node): Pick<ExportedSymbol, 'errors' | 'errorStatus'> {
	const errors = new Set<string>();
	let unknown = false;
	const visit = (node: ts.Node): void => {
		if (node !== root && ts.isFunctionLike(node)) return;
		if (ts.isThrowStatement(node)) {
			if (node.expression && ts.isNewExpression(node.expression))
				errors.add(node.expression.expression.getText());
			else unknown = true;
		}
		if (ts.isCallExpression(node)) {
			const name = node.expression.getText();
			if (name === 'fail') errors.add('ExpectedCliError');
			else if (name === 'error' && node.arguments[0] && ts.isNumericLiteral(node.arguments[0]))
				errors.add(`HttpError ${node.arguments[0].text}`);
			else unknown = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(root);
	return {
		errors: [...errors].sort(),
		errorStatus: unknown ? 'unknown' : errors.size ? 'found' : 'none-found'
	};
}
