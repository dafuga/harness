// @harness-uid u_wwerrde2nk
import ts from 'typescript';
import type { SearchPattern } from '../../../core/development-tooling/bug-class/bugClassSchemas.types';
import type { PatternHit } from './patternHits.types';

export function patternHits(path: string, source: string, patterns: SearchPattern[]): PatternHit[] {
	const text = patterns.filter((pattern) => pattern.kind === 'text');
	const syntax = patterns.filter((pattern) => pattern.kind !== 'text');
	return [
		...literalHits(source, text),
		...scriptBlocks(path, source).flatMap(({ code, offset }) =>
			syntaxHits(path, code, offset, syntax)
		)
	];
}

function literalHits(source: string, patterns: SearchPattern[]): PatternHit[] {
	if (!patterns.length) return [];
	return source
		.split('\n')
		.flatMap((text, index) =>
			patterns
				.filter((pattern) => text.includes(pattern.value))
				.map((pattern) => ({ line: index + 1, pattern }))
		);
}

function scriptBlocks(path: string, source: string) {
	if (/\.[cm]?[jt]sx?$/i.test(path)) return [{ code: source, offset: 0 }];
	if (!/\.(svelte|vue|astro|html)$/i.test(path)) return [];
	return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => {
		const start = match.index + match[0].indexOf('>') + 1;
		return { code: match[1], offset: source.slice(0, start).split('\n').length - 1 };
	});
}

function syntaxHits(path: string, code: string, offset: number, patterns: SearchPattern[]) {
	if (!patterns.some((pattern) => code.includes(pattern.value.split('.').at(-1)!))) return [];
	const scriptPath = /\.[cm]?[jt]sx?$/i.test(path) ? path : path + '.ts';
	const tree = ts.createSourceFile(scriptPath, code, ts.ScriptTarget.Latest, false);
	const hits: PatternHit[] = [];
	for (const node of callNodes(tree)) {
		const kind = ts.isCallExpression(node) ? 'call' : 'construct';
		const name = expressionName(node.expression);
		const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + offset + 1;
		for (const pattern of patterns) {
			if (pattern.kind === kind && (name === pattern.value || name.endsWith('.' + pattern.value)))
				hits.push({ line, pattern });
		}
	}
	return hits;
}

function expressionName(expression: ts.Expression): string {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression))
		return expressionName(expression.expression) + '.' + expression.name.text;
	if (ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression))
		return expressionName(expression.expression) + '.' + expression.argumentExpression.text;
	return '';
}

function* callNodes(root: ts.Node) {
	const nodes: ts.Node[] = [root];
	while (nodes.length) {
		const node = nodes.pop()!;
		node.forEachChild((child) => {
			nodes.push(child);
		});
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) yield node;
	}
}
