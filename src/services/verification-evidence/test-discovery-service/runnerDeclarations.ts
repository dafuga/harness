import ts from 'typescript';
import type { DiscoveredTest } from '../TestDiscoveryService.types';

const runnerKinds: Record<string, 'test' | 'group' | undefined> = {
	test: 'test',
	it: 'test',
	describe: 'group'
};
const disabledModifiers = new Set(['skip', 'only', 'todo', 'fixme', 'fail', 'fails']);
const supportedModifiers = new Set([
	...disabledModifiers,
	'concurrent',
	'sequential',
	'parallel',
	'serial'
]);

/** Inventory leaf cases using suite-qualified identities and inherited runner modifiers. */
export function runnerDeclarations(text: string, file: string): DiscoveredTest[] {
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const aliases = runnerImports(source);
	const tests: DiscoveredTest[] = [];
	const visit = (
		node: ts.Node,
		scope: { titles: string[]; disabled: boolean; dynamic: boolean }
	) => {
		const call = ts.isCallExpression(node) ? registration(node, aliases, source) : undefined;
		if (call?.kind === 'test')
			tests.push({
				file,
				title: [...scope.titles, call.title].join(' > '),
				line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
				dynamic: scope.dynamic || call.dynamic,
				disabled: scope.disabled || call.disabled
			});
		const next =
			call?.kind === 'group'
				? {
						titles: [...scope.titles, call.title],
						disabled: scope.disabled || call.disabled,
						dynamic: scope.dynamic || call.dynamic
					}
				: scope;
		ts.forEachChild(node, (child) => visit(child, next));
	};
	visit(source, { titles: [], disabled: false, dynamic: false });
	return tests;
}

/** Generated registrations inherit the same suite identities and runner modifiers as literal tests. */
export function registrationScope(
	source: ts.SourceFile,
	call: ts.CallExpression
): { titles: string[]; dynamic: boolean; disabled: boolean } {
	const aliases = runnerImports(source);
	const scope = enclosingContext(source, call, aliases);
	const registrar = registrarContext(source, call.arguments[0], aliases);
	return {
		titles: scope.titles,
		dynamic: scope.dynamic || registrar.dynamic,
		disabled: scope.disabled || registrar.disabled
	};
}

function enclosingContext(
	source: ts.SourceFile,
	call: ts.CallExpression,
	aliases: Map<string, 'test' | 'group'>
) {
	const scope = { titles: [] as string[], dynamic: false, disabled: false };
	for (let parent: ts.Node | undefined = call.parent; parent; parent = parent.parent) {
		if (ts.isFunctionLike(parent)) {
			const group = enclosingSuite(parent, source, aliases);
			if (!group) scope.dynamic = true;
			else {
				scope.titles.unshift(group.title);
				scope.dynamic ||= group.dynamic;
				scope.disabled ||= group.disabled;
			}
		} else if (uncertainContext(parent)) scope.dynamic = true;
	}
	return scope;
}

function enclosingSuite(
	node: ts.Node,
	source: ts.SourceFile,
	aliases: Map<string, 'test' | 'group'>
) {
	const parent = node.parent;
	if (!parent || !ts.isCallExpression(parent) || parent.arguments[1] !== node) return undefined;
	const group = registration(parent, aliases, source);
	if (group?.kind !== 'group') return undefined;
	const runner = runnerExpression(parent.expression, source);
	const modifiers = runner.text
		.split('.')
		.slice(aliases.get(runner.text.split('.')[0]) === 'group' ? 1 : 2);
	return {
		...group,
		dynamic: group.dynamic || modifiers.some((name) => !supportedModifiers.has(name))
	};
}

function registrarContext(
	source: ts.SourceFile,
	node: ts.Expression | undefined,
	aliases: Map<string, 'test' | 'group'>
) {
	if (!node) return { dynamic: true, disabled: false };
	const runner = runnerExpression(node, source);
	const [root, ...modifiers] = runner.text.split('.');
	const direct =
		ts.isIdentifier(node) ||
		ts.isPropertyAccessExpression(node) ||
		ts.isElementAccessExpression(node);
	return {
		dynamic:
			!direct ||
			runner.computed ||
			aliases.get(root) !== 'test' ||
			modifiers.some((name) => !supportedModifiers.has(name)),
		disabled: modifiers.some((name) => disabledModifiers.has(name))
	};
}

function uncertainContext(node: ts.Node): boolean {
	const conditional =
		ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node);
	if (conditional || ts.isIterationStatement(node, false) || ts.isTryStatement(node)) return true;
	return (
		ts.isBinaryExpression(node) &&
		[
			ts.SyntaxKind.AmpersandAmpersandToken,
			ts.SyntaxKind.BarBarToken,
			ts.SyntaxKind.QuestionQuestionToken
		].includes(node.operatorToken.kind)
	);
}

function runnerImports(source: ts.SourceFile): Map<string, 'test' | 'group'> {
	const aliases = new Map<string, 'test' | 'group'>();
	for (const statement of source.statements) {
		if (!ts.isImportDeclaration(statement)) continue;
		const bindings = statement.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) continue;
		for (const binding of bindings.elements) {
			const kind = runnerKinds[binding.propertyName?.text ?? binding.name.text];
			if (kind) aliases.set(binding.name.text, kind);
		}
	}
	return aliases;
}

function registration(
	call: ts.CallExpression,
	aliases: Map<string, 'test' | 'group'>,
	source: ts.SourceFile
) {
	const runner = runnerExpression(call.expression, source);
	const expression = runner.text;
	const root = expression.split(/[.(]/)[0];
	const imported = aliases.get(root);
	if (!imported) return undefined;
	if (isFactory(call.expression, expression)) return undefined;
	const kind = imported === 'group' || /\.describe\b/.test(expression) ? 'group' : 'test';
	if (/\.(?:extend|use|beforeAll|afterAll|beforeEach|afterEach)\b/.test(expression))
		return undefined;
	const title = call.arguments[0];
	if (!title) return undefined;
	return {
		kind,
		title: ts.isStringLiteralLike(title) ? title.text : title.getText(source),
		dynamic: runner.computed || isDynamic(title, expression),
		disabled: /\.(?:skip|only|todo|fixme|fails|fail)\b/.test(expression)
	};
}

function isFactory(node: ts.Expression, expression: string): boolean {
	return (
		(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
		/\.(?:each|for)$/.test(expression)
	);
}

function isDynamic(title: ts.Expression, expression: string): boolean {
	return !ts.isStringLiteralLike(title) || /\.each\b|\.for\b/.test(expression);
}

/** Follow the runner chain without interpreting call arguments as modifiers. */
function runnerExpression(
	node: ts.Expression,
	source: ts.SourceFile
): { text: string; computed: boolean } {
	if (ts.isCallExpression(node)) return runnerExpression(node.expression, source);
	if (ts.isTaggedTemplateExpression(node)) return runnerExpression(node.tag, source);
	if (ts.isPropertyAccessExpression(node)) {
		const parent = runnerExpression(node.expression, source);
		return { ...parent, text: `${parent.text}.${node.name.text}` };
	}
	if (ts.isElementAccessExpression(node)) {
		const parent = runnerExpression(node.expression, source);
		const literal = ts.isStringLiteralLike(node.argumentExpression);
		const name = literal ? node.argumentExpression.text : '<computed>';
		return { text: `${parent.text}.${name}`, computed: parent.computed || !literal };
	}
	return { text: node.getText(source), computed: false };
}
