import ts from 'typescript';
import type { Found } from './scanImports.types';

/** Calls to the platform fetch API; comments and quoted source text are never calls. */
export function httpReferences(code: string): Found[] {
	if (!/\bfetch\s*\(/.test(code)) return [];
	const source = ts.createSourceFile(
		'request.ts',
		code,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX
	);
	const found: Found[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node) && platformFetch(node.expression)) {
			const argument = node.arguments[0];
			found.push({
				index: node.getStart(source),
				via: 'http',
				typeOnly: false,
				specifier: requestPath(argument),
				...(requestPath(argument) === null ? { detail: node.getText(source).slice(0, 120) } : {})
			});
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

function platformFetch(expression: ts.Expression): boolean {
	if (ts.isIdentifier(expression)) return expression.text === 'fetch';
	return (
		ts.isPropertyAccessExpression(expression) &&
		expression.name.text === 'fetch' &&
		ts.isIdentifier(expression.expression) &&
		['event', 'window', 'globalThis', 'self'].includes(expression.expression.text)
	);
}

/** Each interpolation stays unknown; only a dynamic route segment can resolve it. */
function requestPath(argument: ts.Expression | undefined): string | null {
	if (!argument) return null;
	if (ts.isStringLiteralLike(argument)) return argument.text;
	if (!ts.isTemplateExpression(argument)) return null;
	return (
		argument.head.text + argument.templateSpans.map((span) => '${}' + span.literal.text).join('')
	);
}
