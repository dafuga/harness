import ts from 'typescript';
import { posix } from 'node:path';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { DiscoveredTest } from '../TestDiscoveryService.types';
import { registrationScope } from './runnerDeclarations';

/** The same committed examples drive static discovery, runtime registration and display. */
export async function exampleDeclarations(
	tree: Pick<SourceTree, 'read'>,
	text: string,
	file: string
): Promise<DiscoveredTest[]> {
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const calls = registeredCalls(source, manifestImports(source, file), file);
	const tests: DiscoveredTest[] = [];
	for (const call of calls) {
		const unresolved = unresolvedRegistration(call, file);
		if (unresolved) {
			tests.push(unresolved);
			continue;
		}
		const unit = componentManifestSchema.parse(JSON.parse(await tree.read(call.path!)));
		if (call.method === 'registerCases') {
			tests.push(
				...(unit.testing?.cases ?? [])
					.filter((item) => item.test.file === call.file)
					.map((item) => ({
						file,
						title: [...call.titles, item.test.title].join(' > '),
						line: call.line,
						dynamic: call.dynamic,
						disabled: call.disabled
					}))
			);
			continue;
		}
		const examples = [
			...(unit.helperContracts ?? []).flatMap((helper) =>
				(helper.examples ?? []).map((example) => ({ subject: helper.name, name: example.name }))
			),
			...(unit.testing?.examples ?? [])
		];
		for (const example of examples)
			tests.push({
				file,
				title: [...call.titles, `${example.subject}: ${example.name}`].join(' > '),
				line: call.line,
				dynamic: call.dynamic,
				disabled: call.disabled
			});
	}
	return tests;
}
function unresolvedRegistration(call: ReturnType<typeof registeredCalls>[number], file: string) {
	let part: string;
	if (!call.path) part = 'manifest';
	else if (call.method === 'registerCases' && !call.file) part = 'file';
	else return undefined;
	return {
		file,
		title: [...call.titles, `<computed registration ${part}>`].join(' > '),
		line: call.line,
		dynamic: true,
		disabled: call.disabled
	};
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
function registeredCalls(source: ts.SourceFile, manifests: Map<string, string>, file: string) {
	const calls: Array<{
		path?: string;
		line: number;
		method: string;
		file?: string;
		titles: string[];
		dynamic: boolean;
		disabled: boolean;
	}> = [];
	const bindings = registrarBindings(source, file);
	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			['registerExamples', 'registerCases'].includes(node.expression.name.text)
		) {
			let input = node.arguments[1];
			while (input && (ts.isAsExpression(input) || ts.isParenthesizedExpression(input)))
				input = input.expression;
			const path = input && ts.isIdentifier(input) ? manifests.get(input.text) : undefined;
			if ([Boolean(path), importedRunner(source, node.arguments[0])].includes(true)) {
				const scope = registrationScope(source, node);
				calls.push({
					path,
					line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
					method: node.expression.name.text,
					...scope,
					dynamic: [
						scope.dynamic,
						!path,
						!trustedReceiver(node.expression.expression, bindings)
					].includes(true),
					...registrationFile(node)
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return calls;
}

function importedRunner(source: ts.SourceFile, expression: ts.Expression | undefined): boolean {
	while (
		expression &&
		(ts.isPropertyAccessExpression(expression) ||
			ts.isElementAccessExpression(expression) ||
			ts.isCallExpression(expression))
	)
		expression = expression.expression;
	if (!expression || !ts.isIdentifier(expression)) return false;
	const name = expression.text;
	return source.statements.some((node) => {
		if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly) return false;
		const bindings = node.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) return false;
		return bindings.elements.some(
			(item) =>
				!item.isTypeOnly &&
				item.name.text === name &&
				['test', 'it'].includes(item.propertyName?.text ?? item.name.text)
		);
	});
}

function registrarBindings(source: ts.SourceFile, file: string) {
	const constructors = registrarImports(source, file);
	const instances = new Set<string>();
	for (const node of source.statements) {
		if (!ts.isVariableStatement(node) || !(node.declarationList.flags & ts.NodeFlags.Const))
			continue;
		for (const item of node.declarationList.declarations)
			if (ts.isIdentifier(item.name) && constructedRegistrar(item.initializer, constructors))
				instances.add(item.name.text);
	}
	return { constructors, instances };
}
function registrarImports(source: ts.SourceFile, file: string): Set<string> {
	const names = new Set<string>();
	for (const node of source.statements) {
		const bindings = registrarImport(node, file);
		if (!bindings) continue;
		for (const item of bindings.elements)
			if (
				!item.isTypeOnly &&
				(item.propertyName?.text ?? item.name.text) === 'TestExpectationService'
			)
				names.add(item.name.text);
	}
	return names;
}

function registrarImport(node: ts.Node, file: string): ts.NamedImports | undefined {
	if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return undefined;
	if (!trustedImport(node.moduleSpecifier.text, file) || node.importClause?.isTypeOnly)
		return undefined;
	const bindings = node.importClause?.namedBindings;
	return bindings && ts.isNamedImports(bindings) ? bindings : undefined;
}

function trustedImport(specifier: string, file: string): boolean {
	if (['@dafuga01/harness', '@dafuga01/harness/verification'].includes(specifier)) return true;
	if (!specifier.startsWith('.')) return false;
	const path = posix
		.normalize(posix.join(posix.dirname(file), specifier))
		.replace(/\.[cm]?[jt]s$/, '');
	return [
		'src/services/verification-evidence/TestExpectationService',
		'src/lib/verification',
		'src/lib/index',
		'src/index'
	].includes(path);
}

function trustedReceiver(
	receiver: ts.Expression,
	bindings: { constructors: Set<string>; instances: Set<string> }
): boolean {
	return ts.isIdentifier(receiver)
		? bindings.instances.has(receiver.text)
		: constructedRegistrar(receiver, bindings.constructors);
}
function constructedRegistrar(node: ts.Expression | undefined, constructors: Set<string>): boolean {
	return Boolean(
		node &&
		ts.isNewExpression(node) &&
		ts.isIdentifier(node.expression) &&
		constructors.has(node.expression.text)
	);
}

function registrationFile(call: ts.CallExpression): { file?: string } {
	const file = call.arguments[2];
	return file && ts.isStringLiteralLike(file) ? { file: file.text } : {};
}
