import ts from 'typescript';

function functionName(node: ts.Node): string | undefined {
	if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.name?.text;
	if (ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent)) {
		return ts.isIdentifier(node.parent.name) ? node.parent.name.text : undefined;
	}
	return undefined;
}

function binds(node: ts.Node | undefined, name: string): boolean {
	if (!node) return false;
	if (ts.isIdentifier(node)) return node.text === name;
	if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
		return node.elements.some(
			(element) => ts.isBindingElement(element) && binds(element.name, name)
		);
	}
	return false;
}

function blockBinds(block: ts.Block, name: string): boolean {
	return block.statements.some((statement) => {
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.some((item) => binds(item.name, name));
		}
		return (
			(ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
			statement.name?.text === name
		);
	});
}

function scopeBinds(node: ts.Node, name: string): boolean {
	if (ts.isFunctionLike(node))
		return (
			node.parameters.some((item) => binds(item.name, name)) ||
			(ts.isFunctionExpression(node) && node.name?.text === name)
		);
	if (ts.isBlock(node)) return blockBinds(node, name);
	if (ts.isCatchClause(node)) return binds(node.variableDeclaration?.name, name);
	return loopBinds(node, name);
}

function loopBinds(node: ts.Node, name: string): boolean {
	if (!ts.isForOfStatement(node) && !ts.isForInStatement(node) && !ts.isForStatement(node))
		return false;
	return Boolean(
		node.initializer &&
		ts.isVariableDeclarationList(node.initializer) &&
		node.initializer.declarations.some((item) => binds(item.name, name))
	);
}

/** A runtime reference's named function owner and whether an inner binding hides its import. */
export function helperScopes(node: ts.Node, name: string) {
	const names: string[] = [];
	let shadowed = false;
	for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
		const named = functionName(parent);
		if (named) names.unshift(named);
		shadowed ||= scopeBinds(parent, name);
	}
	return { caller: names.length ? names.join('.') : null, shadowed };
}
