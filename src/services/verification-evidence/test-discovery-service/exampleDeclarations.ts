import ts from 'typescript';
import { posix } from 'node:path';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { DiscoveredTest } from '../TestDiscoveryService.types';

/** The same committed examples drive static discovery, runtime registration and display. */
export async function exampleDeclarations(
	tree: Pick<SourceTree, 'read'>,
	text: string,
	file: string
): Promise<DiscoveredTest[]> {
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const calls = registeredCalls(source, manifestImports(source, file));
	const tests: DiscoveredTest[] = [];
	for (const call of calls) {
		const unit = componentManifestSchema.parse(JSON.parse(await tree.read(call.path)));
		const examples = [
			...(unit.helperContracts ?? []).flatMap((helper) =>
				(helper.examples ?? []).map((example) => ({ subject: helper.name, name: example.name }))
			),
			...(unit.testing?.examples ?? [])
		];
		for (const example of examples)
			tests.push({
				file,
				title: `${example.subject}: ${example.name}`,
				line: call.line,
				dynamic: false,
				disabled: false
			});
	}
	return tests;
}
function manifestImports(source: ts.SourceFile, file: string): Map<string, string> {
	const manifests = new Map<string, string>();
	for (const node of source.statements) {
		if (
			!ts.isImportDeclaration(node) ||
			!node.importClause?.name ||
			!ts.isStringLiteral(node.moduleSpecifier)
		)
			continue;
		if (node.moduleSpecifier.text.endsWith('.json'))
			manifests.set(
				node.importClause.name.text,
				posix.normalize(posix.join(posix.dirname(file), node.moduleSpecifier.text))
			);
	}
	return manifests;
}
function registeredCalls(source: ts.SourceFile, manifests: Map<string, string>) {
	const calls: Array<{ path: string; line: number }> = [];
	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'registerExamples'
		) {
			let input = node.arguments[1];
			while (input && (ts.isAsExpression(input) || ts.isParenthesizedExpression(input)))
				input = input.expression;
			const path = input && ts.isIdentifier(input) ? manifests.get(input.text) : undefined;
			if (path)
				calls.push({ path, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return calls;
}
