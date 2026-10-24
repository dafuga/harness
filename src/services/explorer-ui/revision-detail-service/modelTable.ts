import ts from 'typescript';
import type { ModelDefinition, ModelTable } from '../../../utils/explorer-ui/unitMetadata';
import type { SqliteModel, SqliteField } from '../../../core/development-tooling/sqliteTypes';
import { sqliteColumn, sqliteTableSql } from '../../../utils/development-tooling/sqliteTableSql';

const storage = {
	string: 'TEXT',
	number: 'INTEGER',
	boolean: 'INTEGER',
	json: 'TEXT',
	blob: 'BLOB'
};

/** Only literal SQLite model definitions become schema facts; expressions are never evaluated. */
export function modelTable(
	node: ts.ClassDeclaration,
	file: ts.SourceFile
): Pick<ModelDefinition, 'table' | 'tableGap'> {
	const declared = node.members.find(
		(member) =>
			ts.isPropertyDeclaration(member) &&
			member.name.getText(file) === 'definition' &&
			member.modifiers?.some((item) => item.kind === ts.SyntaxKind.StaticKeyword)
	);
	if (!declared || !ts.isPropertyDeclaration(declared) || !declared.initializer) return {};
	const value = literal(declared.initializer);
	const model = definition(value);
	if (!model)
		return { tableGap: 'The table definition is not statically readable at this revision.' };
	try {
		sqliteTableSql(model);
		return { table: tableOf(model) };
	} catch {
		return { tableGap: 'The declared table does not satisfy the SQLite model schema.' };
	}
}

function tableOf(model: SqliteModel): ModelTable {
	const primaryKey = model.primaryKey ?? 'id';
	return {
		name: model.table,
		primaryKey,
		columns: Object.entries(model.fields).map(([property, field]) => ({
			property,
			name: sqliteColumn(property, field),
			type: storage[field.type],
			nullable: property !== primaryKey && Boolean(field.nullable),
			primaryKey: property === primaryKey,
			...(field.default === 'timestamp' ? { default: 'CURRENT_TIMESTAMP' } : {})
		}))
	};
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function definition(value: unknown): SqliteModel | undefined {
	if (!record(value) || typeof value.table !== 'string' || !record(value.fields)) return undefined;
	if (value.primaryKey !== undefined && typeof value.primaryKey !== 'string') return undefined;
	if (!Object.values(value.fields).every(validField)) return undefined;
	return value as unknown as SqliteModel;
}

function validField(value: unknown): value is SqliteField {
	if (!record(value) || typeof value.type !== 'string' || !Object.hasOwn(storage, value.type))
		return false;
	return (
		(value.column === undefined || typeof value.column === 'string') &&
		(value.nullable === undefined || typeof value.nullable === 'boolean') &&
		(value.default === undefined || value.default === 'timestamp')
	);
}

/** Unknown calls, spreads and computed keys leave the entire schema unresolved. */
function literal(node: ts.Expression, depth = 0): unknown {
	if (depth > 10) return undefined;
	if (asserted(node)) return literal(node.expression, depth + 1);
	if (ts.isStringLiteralLike(node)) return node.text;
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	return ts.isObjectLiteralExpression(node) ? objectLiteral(node, depth) : undefined;
}

function asserted(
	node: ts.Expression
): node is
	| ts.ParenthesizedExpression
	| ts.AsExpression
	| ts.TypeAssertion
	| ts.SatisfiesExpression {
	return (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isSatisfiesExpression(node)
	);
}

function objectLiteral(node: ts.ObjectLiteralExpression, depth: number): unknown {
	const pairs: Array<[string, unknown]> = [];
	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property)) return undefined;
		const name = property.name;
		if (!ts.isIdentifier(name) && !ts.isStringLiteralLike(name)) return undefined;
		const value = literal(property.initializer, depth + 1);
		if (value === undefined) return undefined;
		pairs.push([name.text, value]);
	}
	return Object.fromEntries(pairs);
}
