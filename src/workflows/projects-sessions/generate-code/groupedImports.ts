import ts from 'typescript';
import { posix } from 'node:path';

/** Rewrite module addresses only. Ordinary strings, operators and template contents stay intact. */
export function groupedImports(
	contents: string,
	before: string,
	after: string,
	paths: Map<string, string>
): string {
	const edits: Array<{ start: number; end: number; text: string }> = [];
	const atoms = /<!-- @harness-atoms (\S+) -->/.exec(contents);
	if (atoms) {
		const start = atoms.index + atoms[0].indexOf(atoms[1]);
		edits.push({
			start,
			end: start + atoms[1].length,
			text: groupedSpecifier(atoms[1], before, after, paths)
		});
	}
	const scripts = before.endsWith('.svelte')
		? [...contents.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => ({
				text: match[1],
				offset: match.index + match[0].indexOf('>') + 1
			}))
		: [{ text: contents, offset: 0 }];
	for (const script of scripts) {
		const source = ts.createSourceFile(before, script.text, ts.ScriptTarget.Latest, true);
		const visit = (node: ts.Node): void => {
			const literal = moduleLiteral(node);
			if (
				literal &&
				literal.text.startsWith('.') &&
				!(ts.isNewExpression(node) && literal.text.endsWith('.js'))
			) {
				const text = groupedSpecifier(literal.text, before, after, paths);
				if (text !== literal.text)
					edits.push({
						start: script.offset + literal.getStart(source) + 1,
						end: script.offset + literal.end - 1,
						text
					});
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return edits
		.sort((left, right) => right.start - left.start)
		.reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), contents);
}

function moduleLiteral(node: ts.Node): ts.StringLiteralLike | undefined {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		return stringArgument(node.moduleSpecifier);
	if (ts.isCallExpression(node)) return callModule(node);
	if (ts.isNewExpression(node)) return sourceURL(node);
	return undefined;
}

function stringArgument(node: ts.Node | undefined): ts.StringLiteralLike | undefined {
	return node && ts.isStringLiteralLike(node) ? node : undefined;
}

function callModule(node: ts.CallExpression): ts.StringLiteralLike | undefined {
	if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
		return stringArgument(node.arguments[0]);
	if (!ts.isIdentifier(node.expression)) return undefined;
	return node.expression.text === 'require' ? stringArgument(node.arguments[0]) : undefined;
}

function sourceURL(node: ts.NewExpression): ts.StringLiteralLike | undefined {
	if (!ts.isIdentifier(node.expression)) return undefined;
	if (node.expression.text !== 'URL') return undefined;
	if (node.arguments?.[1]?.getText() !== 'import.meta.url') return undefined;
	return stringArgument(node.arguments[0]);
}

/** A generated import keeps its explicit extension, or its original extensionless convention. */
export function groupedSpecifier(
	specifier: string,
	before: string,
	after: string,
	paths: Map<string, string>
): string {
	if (specifier.endsWith('/$types')) return specifier;
	const target = posix.normalize(posix.join(posix.dirname(before), specifier));
	const matched = [
		target,
		target + '.ts',
		target + '.svelte',
		target + '.svelte.ts',
		target + '/index.ts'
	].find((path) => paths.has(path));
	const next = matched ? paths.get(matched)! : target;
	const extension = matched ? matched.slice(target.length) : '';
	const address = extension && next.endsWith(extension) ? next.slice(0, -extension.length) : next;
	const relative = posix.relative(posix.dirname(after), address);
	const addressWithPrefix = relative.startsWith('.') ? relative : './' + relative;
	return specifier.endsWith('/') && !addressWithPrefix.endsWith('/')
		? addressWithPrefix + '/'
		: addressWithPrefix;
}
