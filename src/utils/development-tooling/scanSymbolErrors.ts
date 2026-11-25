// @harness-uid u_vkx5vqjo6s
import ts from 'typescript';
import type { ExportedSymbol } from '../../core/development-tooling/sourceTypes';

/** Bind observed throws to their declaration; indirect calls remain explicitly uncertain. */
export function scanSymbolErrors(code: string, symbols: ExportedSymbol[]): ExportedSymbol[] {
	const file = ts.createSourceFile('exports.ts', code, ts.ScriptTarget.Latest, true);
	const declarations = errorDeclarations(file);
	const failures = failBindings(file, declarations);
	return symbols.map((symbol) => {
		const node = declarations.get(symbol.name);
		return node ? { ...symbol, ...errorsIn(node, failures) } : symbol;
	});
}

/** Whether the file calls the CLI `fail` through an import binding that no local name shadows. */
export function callsCliFail(code: string): boolean {
	const file = ts.createSourceFile('exports.ts', code, ts.ScriptTarget.Latest, true);
	const failures = failBindings(file, new Map());
	let found = false;
	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const name = node.expression.text;
			found = found || (failures.get(name) === 'cli' && !isShadowed(node, name));
		}
		if (!found) ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}

/** A call named `fail` means the CLI error only when it is bound to the CLI errors module. */
function failBindings(
	file: ts.SourceFile,
	declarations: Map<string, ts.Node>
): Map<string, 'cli' | ts.Node> {
	const bindings: Map<string, 'cli' | ts.Node> = new Map(
		cliFailNames(file).map((name) => [name, 'cli'])
	);
	const local = declarations.get('fail');
	if (local && !bindings.has('fail')) bindings.set('fail', local);
	return bindings;
}

/** Local names that import `fail` from a module named `errors`. */
function cliFailNames(file: ts.SourceFile): string[] {
	return file.statements
		.filter(ts.isImportDeclaration)
		.filter((statement) => ts.isStringLiteral(statement.moduleSpecifier))
		.filter((statement) =>
			/(^|\/)errors$/.test((statement.moduleSpecifier as ts.StringLiteral).text)
		)
		.flatMap((statement) => {
			const named = statement.importClause?.namedBindings;
			return named && ts.isNamedImports(named) ? named.elements : [];
		})
		.filter((element) => (element.propertyName ?? element.name).text === 'fail')
		.map((element) => element.name.text);
}

function isShadowed(call: ts.CallExpression, name: string): boolean {
	for (let node: ts.Node | undefined = call.parent; node; node = node.parent) {
		if (ts.isFunctionLike(node) && node.parameters.some((p) => p.name.getText() === name))
			return true;
		if (!ts.isBlock(node)) continue;
		for (const statement of node.statements) {
			if (!ts.isVariableStatement(statement)) continue;
			if (statement.declarationList.declarations.some((d) => d.name.getText() === name))
				return true;
		}
	}
	return false;
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

function errorsIn(
	root: ts.Node,
	failures: Map<string, 'cli' | ts.Node>
): Pick<ExportedSymbol, 'errors' | 'errorStatus'> {
	const errors = new Set<string>();
	let unknown = false;
	const visit = (node: ts.Node): void => {
		if (node !== root && ts.isFunctionLike(node)) return;
		unknown = observeError(node, errors, failures) || unknown;
		ts.forEachChild(node, visit);
	};
	visit(root);
	if (unknown) return { errors: [...errors].sort(), errorStatus: 'unknown' };
	return { errors: [...errors].sort(), errorStatus: errors.size ? 'found' : 'none-found' };
}

function observeError(
	node: ts.Node,
	errors: Set<string>,
	failures: Map<string, 'cli' | ts.Node>
): boolean {
	if (ts.isThrowStatement(node)) {
		if (!node.expression || !ts.isNewExpression(node.expression)) return true;
		errors.add(node.expression.expression.getText());
	}
	if (!ts.isCallExpression(node)) return false;
	const name = node.expression.getText();
	const failure = failures.get(name);
	if (failure && !isShadowed(node, name)) return observeFail(failure, errors);
	return !observeStatusHelper(node, name, errors);
}

/** Both SvelteKit helpers throw a typed error with their literal status. */
function observeStatusHelper(node: ts.CallExpression, name: string, errors: Set<string>): boolean {
	const status = node.arguments[0];
	if (!['error', 'redirect'].includes(name) || !status || !ts.isNumericLiteral(status))
		return false;
	errors.add(`${name === 'error' ? 'HttpError' : 'Redirect'} ${status.text}`);
	return true;
}

function observeFail(failure: 'cli' | ts.Node, errors: Set<string>): boolean {
	if (failure === 'cli') {
		errors.add('ExpectedCliError');
		return false;
	}
	// A same-file `fail` contributes what its own body throws; calls it makes stay uncertain.
	const own = errorsIn(failure, new Map());
	own.errors?.forEach((name) => errors.add(name));
	return own.errorStatus === 'unknown';
}
