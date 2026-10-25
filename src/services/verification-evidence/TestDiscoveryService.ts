import ts from 'typescript';
import { exampleDeclarations } from './test-discovery-service/exampleDeclarations';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import type { DiscoveredTest, TestDiscovery } from './TestDiscoveryService.types';

/** Static inventory fails closed on computed cases requiring actual runner discovery. */
export class TestDiscoveryService {
	async discover(tree: Pick<SourceTree, 'read'>, paths: string[]): Promise<TestDiscovery> {
		const tests: DiscoveredTest[] = [],
			errors: string[] = [];
		for (const file of paths) {
			try {
				const text = await tree.read(file);
				tests.push(...this.scan(text, file), ...(await exampleDeclarations(tree, text, file)));
			} catch {
				errors.push(`Cannot read test declarations: ${file}`);
			}
		}
		for (const test of tests) {
			if (test.dynamic)
				errors.push(`${test.file}:${test.line}: computed case requires runner discovery`);
			if (test.disabled)
				errors.push(`${test.file}:${test.line}: skipped, exclusive or todo case is not coverage`);
		}
		return { tests, errors };
	}
	scan(text: string, file: string): DiscoveredTest[] {
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		const names = this.names(source);
		const tests: DiscoveredTest[] = [];
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node) && this.registration(node, names)) {
				const title = node.arguments[0];
				const expression = node.expression.getText(source);
				tests.push({
					file,
					title:
						title && ts.isStringLiteralLike(title) ? title.text : (title?.getText(source) ?? ''),
					line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
					dynamic: !title || !ts.isStringLiteralLike(title) || /\.each\b|\.for\b/.test(expression),
					disabled: /\.(?:skip|only|todo|fixme)\b/.test(expression)
				});
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		return tests;
	}
	private names(source: ts.SourceFile): Set<string> {
		const names = new Set<string>();
		for (const statement of source.statements) {
			if (!ts.isImportDeclaration(statement)) continue;
			const bindings = statement.importClause?.namedBindings;
			if (!bindings || !ts.isNamedImports(bindings)) continue;
			for (const binding of bindings.elements)
				if (['test', 'it'].includes(binding.propertyName?.text ?? binding.name.text))
					names.add(binding.name.text);
		}
		return names;
	}

	private registration(call: ts.CallExpression, names: Set<string>): boolean {
		const expression = call.expression;
		if (ts.isIdentifier(expression)) return names.has(expression.text);
		if (ts.isPropertyAccessExpression(expression)) {
			if (
				['each', 'for', 'extend', 'use', 'describe', 'beforeEach', 'afterEach'].includes(
					expression.name.text
				)
			)
				return false;
			return (
				this.root(expression.expression, names) &&
				Boolean(call.arguments[0]) &&
				ts.isStringLiteralLike(call.arguments[0])
			);
		}
		return ts.isCallExpression(expression) && this.root(expression.expression, names);
	}
	private root(node: ts.Expression, names: Set<string>): boolean {
		if (ts.isIdentifier(node)) return names.has(node.text);
		if (ts.isPropertyAccessExpression(node)) return this.root(node.expression, names);
		if (ts.isCallExpression(node)) return this.root(node.expression, names);
		return false;
	}
}
export type { DiscoveredTest, TestDiscovery } from './TestDiscoveryService.types';
