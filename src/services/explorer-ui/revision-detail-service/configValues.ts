import type { ConfigSource } from './configValues.types';
import ts from 'typescript';
import { configValueStructure } from './configValueStructure';
import type { ConfigVariable } from '../../../utils/explorer-ui/unitMetadata';

/** Read committed config expressions without importing or executing their module. */
export function configValues(text: string, source: string): ConfigVariable[] {
	const code = source.endsWith('.json') ? `export default ${text};` : text;
	const file = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const statements = file.statements.map((statement) => ({
		statement,
		bindings: bindingsOf(statement)
	}));
	const context: ConfigSource = {
		file,
		source,
		bindings: new Map(
			statements.flatMap(({ bindings }) => bindings.map(({ name, value }) => [name, value]))
		),
		values: new Map(),
		ancestors: new Set()
	};
	for (const { statement, bindings } of statements) {
		if (
			ts.isVariableStatement(statement) &&
			statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)
		) {
			for (const { name, value } of bindings) readValue(value, name, context);
		}
		if (ts.isExportAssignment(statement) && !statement.isExportEquals)
			readValue(
				statement.expression,
				source
					.split('/')
					.at(-1)!
					.replace(/\.[^.]+$/, ''),
				context
			);
	}
	return [...context.values.values()];
}

function bindingsOf(statement: ts.Statement): Array<{ name: string; value: ts.Expression }> {
	if (!ts.isVariableStatement(statement)) return [];
	return statement.declarationList.declarations.flatMap((declaration) =>
		ts.isIdentifier(declaration.name) && declaration.initializer
			? [{ name: declaration.name.text, value: declaration.initializer }]
			: []
	);
}

function asserted(
	value: ts.Expression
): value is
	| ts.ParenthesizedExpression
	| ts.AsExpression
	| ts.TypeAssertion
	| ts.SatisfiesExpression {
	return (
		ts.isParenthesizedExpression(value) ||
		ts.isAsExpression(value) ||
		ts.isTypeAssertionExpression(value) ||
		ts.isSatisfiesExpression(value)
	);
}

function expression(
	value: ts.Expression,
	bindings: ConfigSource['bindings'],
	seen = new Set<string>()
): ts.Expression {
	if (asserted(value)) return expression(value.expression, bindings, seen);
	if (ts.isIdentifier(value) && bindings.has(value.text) && !seen.has(value.text))
		return expression(bindings.get(value.text)!, bindings, new Set([...seen, value.text]));
	if (
		ts.isCallExpression(value) &&
		/^(?:\w+\.)?defineConfig$/.test(value.expression.getText()) &&
		value.arguments.length === 1
	)
		return expression(value.arguments[0], bindings, seen);
	return value;
}

function propertyPath(parent: string, name: ts.PropertyName): string {
	if (ts.isIdentifier(name)) return `${parent}.${name.text}`;
	if (ts.isStringLiteralLike(name))
		return /^[A-Za-z_$][\w$]*$/.test(name.text)
			? `${parent}.${name.text}`
			: `${parent}[${JSON.stringify(name.text)}]`;
	return `${parent}${ts.isComputedPropertyName(name) ? name.getText() : `[${name.getText()}]`}`;
}

function readValue(value: ts.Expression, name: string, context: ConfigSource): void {
	const resolved = expression(value, context.bindings);
	if (context.ancestors.has(resolved)) {
		context.values.set(name, { name, value: value.getText(context.file), source: context.source });
		return;
	}
	if (
		ts.isObjectLiteralExpression(resolved) &&
		resolved.properties.length &&
		!resolved.properties.some(ts.isSpreadAssignment)
	) {
		const next = { ...context, ancestors: new Set([...context.ancestors, resolved]) };
		for (const property of resolved.properties) {
			if (ts.isPropertyAssignment(property))
				readValue(property.initializer, propertyPath(name, property.name), next);
			else if (ts.isShorthandPropertyAssignment(property))
				readValue(property.name, propertyPath(name, property.name), next);
		}
		return;
	}
	const structure = configValueStructure(resolved, context.bindings);
	context.values.set(name, {
		name,
		value: resolved.getText(context.file),
		source: context.source,
		...(structure.kind === 'expression' ? {} : { structure }),
		...literalValue(resolved)
	});
}

/** Decode syntax literals; never import, evaluate, or resolve the host environment. */
function literalValue(expression: ts.Expression): { literal: unknown } | undefined {
	if (ts.isStringLiteralLike(expression)) return { literal: expression.text };
	if (expression.kind === ts.SyntaxKind.TrueKeyword) return { literal: true };
	if (expression.kind === ts.SyntaxKind.FalseKeyword) return { literal: false };
	if (expression.kind === ts.SyntaxKind.NullKeyword) return { literal: null };
	if (ts.isArrayLiteralExpression(expression)) {
		const items = expression.elements.map(literalValue);
		if (items.every((item) => item !== undefined))
			return { literal: items.map((item) => item.literal) };
		return undefined;
	}
	return numericValue(expression);
}

function numericValue(expression: ts.Expression): { literal: number } | undefined {
	let number: number;
	if (ts.isNumericLiteral(expression)) number = Number(expression.text);
	else if (ts.isPrefixUnaryExpression(expression) && ts.isNumericLiteral(expression.operand)) {
		if (expression.operator === ts.SyntaxKind.MinusToken) number = -Number(expression.operand.text);
		else if (expression.operator === ts.SyntaxKind.PlusToken)
			number = Number(expression.operand.text);
		else return undefined;
	} else return undefined;
	return Number.isFinite(number) ? { literal: number } : undefined;
}
