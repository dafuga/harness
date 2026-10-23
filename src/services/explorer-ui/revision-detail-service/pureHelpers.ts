import type { Callable } from './pureHelpers.types';
import ts from 'typescript';
import { pureHelperCalls, pureGlobals } from './pureHelperCalls';

function declared(node: ts.Node): boolean {
	return ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'pure');
}

function definition(node: Callable): ts.Node | undefined {
	if (ts.isFunctionDeclaration(node)) return node;
	const value = node.declarationList.declarations[0]?.initializer;
	return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ? value : undefined;
}

function callableName(node: Callable): string | undefined {
	if (ts.isFunctionDeclaration(node)) return node.name?.text;
	const name = node.declarationList.declarations[0]?.name;
	return name && ts.isIdentifier(name) ? name.text : undefined;
}

function localNames(node: ts.Node, names: Set<string>): void {
	if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
		const bind = (name: ts.Node): void => {
			if (ts.isIdentifier(name)) names.add(name.text);
			else ts.forEachChild(name, bind);
		};
		bind(node.name);
	}
	ts.forEachChild(node, (child) => localNames(child, names));
}

function bound(node: ts.Identifier, names: Set<string>): boolean {
	const parent = node.parent;
	if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
	if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
	return names.has(node.text);
}

function mutation(node: ts.Node): boolean {
	if (ts.isBinaryExpression(node))
		return (
			node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
			node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
		);
	if (ts.isDeleteExpression(node)) return true;
	if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
		return [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator);
	return false;
}

function effect(node: ts.Node, local: Set<string>): boolean {
	if (ts.isCallExpression(node)) return !pureHelperCalls(node, local);
	if (ts.isNewExpression(node))
		return node.expression.getText() !== 'Date' || node.arguments?.length !== 1;
	return [
		ts.SyntaxKind.ThisKeyword,
		ts.SyntaxKind.AwaitExpression,
		ts.SyntaxKind.YieldExpression,
		ts.SyntaxKind.AsyncKeyword
	].includes(node.kind);
}

function supported(node: ts.Node, local: Set<string>, bindings: Set<string>): boolean {
	if (ts.isTypeNode(node)) return true;
	if (ts.isIdentifier(node) && !bound(node, bindings)) return false;
	if (mutation(node) || effect(node, local)) return false;
	let valid = true;
	ts.forEachChild(node, (child) => {
		if (!supported(child, local, bindings)) valid = false;
	});
	return valid;
}

/** Explicit @pure contracts, excluding unsupported effects and dependencies at this source. */
export function pureHelpers(code: string): Set<string> {
	const source = ts.createSourceFile('helper.ts', code, ts.ScriptTarget.Latest, true);
	const candidates = source.statements.filter(
		(node): node is Callable =>
			(ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) && declared(node)
	);
	const held = new Map(
		candidates.flatMap((node) => {
			const name = callableName(node),
				body = definition(node);
			return name && body ? [[name, body] as const] : [];
		})
	);
	const names = new Set(held.keys());
	for (let changed = true; changed; ) {
		changed = false;
		for (const [name, node] of held)
			if (names.has(name) && !supported(node, names, bindingsOf(node, names))) {
				names.delete(name);
				changed = true;
			}
	}
	return names;
}

function bindingsOf(node: ts.Node, local: Set<string>): Set<string> {
	const names = new Set([
		...pureGlobals,
		...local,
		'Math',
		'JSON',
		'Object',
		'Array',
		'Date',
		'undefined',
		'NaN',
		'Infinity'
	]);
	localNames(node, names);
	return names;
}
