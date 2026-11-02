// @harness-uid u_ude6avnxc2
import ts from 'typescript';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { parameterDefault } from '../../../utils/development-tooling/parameterDefault';

/** Read schema syntax without importing the model, evaluating validators or accessing storage. */
export function scanStorage(code: string): NonNullable<ComponentManifest['contract']['storage']> {
	const file = ts.createSourceFile('model.ts', code, ts.ScriptTarget.Latest, true);
	return file.statements.flatMap((node) => {
		if (
			!ts.isClassDeclaration(node) ||
			!node.name ||
			!node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		)
			return [];
		const definition = node.members.find(
			(member) =>
				ts.isPropertyDeclaration(member) &&
				member.name.getText(file) === 'definition' &&
				member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
		);
		if (!definition || !ts.isPropertyDeclaration(definition) || !definition.initializer) return [];
		return [storageOf(node.name.text, definition.initializer)];
	});
}

function properties(node: ts.Expression): Map<string, ts.Expression> | undefined {
	if (
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node) ||
		ts.isParenthesizedExpression(node) ||
		ts.isTypeAssertionExpression(node)
	)
		return properties(node.expression);
	if (!ts.isObjectLiteralExpression(node)) return undefined;
	const pairs: Array<[string, ts.Expression]> = [];
	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
			return undefined;
		pairs.push([
			ts.isStringLiteralLike(property.name) ? property.name.text : property.name.getText(),
			property.initializer
		]);
	}
	return new Map(pairs);
}

function stringValue(node: ts.Expression | undefined): string | undefined {
	const value = parameterDefault(node).default;
	return typeof value === 'string' ? value : undefined;
}

function storageOf(
	name: string,
	expression: ts.Expression
): NonNullable<ComponentManifest['contract']['storage']>[number] {
	const definition = properties(expression);
	if (!definition) return { name, fields: [], unresolved: [`definition: ${expression.getText()}`] };
	const table = stringValue(definition.get('table'));
	const primaryKey = definition.has('primaryKey')
		? stringValue(definition.get('primaryKey'))
		: 'id';
	const declaredFields = definition.get('fields');
	const fields = declaredFields ? properties(declaredFields) : undefined;
	const unresolved = storageGaps(table, primaryKey, fields);
	return {
		name,
		...(table ? { table } : {}),
		...(primaryKey ? { primaryKey } : {}),
		fields: [...(fields ?? [])].map(([field, node]) => storageField(field, node, primaryKey)),
		...sourceRules(definition),
		...(unresolved.length ? { unresolved } : {})
	};
}

function storageGaps(
	table: string | undefined,
	primaryKey: string | undefined,
	fields: Map<string, ts.Expression> | undefined
): string[] {
	return [
		...(!table ? ['table is not a string literal'] : []),
		...(!primaryKey ? ['primaryKey is not a string literal'] : []),
		...(!fields ? ['fields are not a literal property map'] : [])
	];
}

function storageField(name: string, expression: ts.Expression, primaryKey: string | undefined) {
	const field = properties(expression);
	if (!field)
		return { name, type: 'unknown', description: `Unresolved field: ${expression.getText()}` };
	const key = primaryKey === name;
	const nullable = key ? false : parameterDefault(field.get('nullable')).default === true;
	const required =
		key ||
		(field.has('required')
			? parameterDefault(field.get('required')).default === true
			: !nullable && !field.has('default'));
	return {
		name,
		type: stringValue(field.get('type')) ?? 'unknown',
		required,
		nullable,
		primaryKey: key,
		...parameterDefault(field.get('default')),
		...sourceRules(field)
	};
}

function sourceRules(properties: Map<string, ts.Expression>) {
	const validation = properties.get('validation') ?? properties.get('validate');
	const relations =
		properties.get('relations') ?? properties.get('references') ?? properties.get('relation');
	return {
		...(validation ? { validation: validation.getText() } : {}),
		...(relations ? { relations: relations.getText() } : {})
	};
}
