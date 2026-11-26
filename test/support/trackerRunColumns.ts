import ts from 'typescript';
import type { RunColumnSource, RunColumnUsage } from './trackerRunColumns.types';

/** Property reads count only on receivers named like a run, so `item.project` proves nothing. */
const runReceiver =
	/(run|row|prior|previous|current|latest|candidate|attempt|receipt)s?(\[\d+\])?$/i;
const runTable = /\b(FROM|JOIN|UPDATE|INTO)\s+(main\.)?(remote_|all_)?runs\b/;

export function runColumns(schema: string): string[] {
	const body = schema.split('CREATE TABLE IF NOT EXISTS runs(')[1].split(');')[0];
	return body
		.split(',')
		.map((definition) => definition.trim().split(/\s+/)[0])
		.filter(Boolean);
}

/** Which run columns the sources read back, and which they assign a value by name. */
export function runColumnUsage(
	columns: readonly string[],
	sources: readonly RunColumnSource[]
): RunColumnUsage {
	const usage: RunColumnUsage = { read: new Set(), assigned: new Set() };
	for (const { path, text } of sources) {
		const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
		const visit = (node: ts.Node) => {
			for (const name of readNames(node, columns)) usage.read.add(name);
			const assigned = assignedName(node);
			if (assigned && columns.includes(assigned)) usage.assigned.add(assigned);
			ts.forEachChild(node, visit);
		};
		visit(file);
	}
	return usage;
}

function readNames(node: ts.Node, columns: readonly string[]): string[] {
	if (ts.isStringLiteralLike(node)) return sqlReads(node.text, columns);
	if (ts.isTemplateExpression(node)) return sqlReads(node.getText(), columns);
	const name = propertyRead(node) ?? destructuredRead(node);
	return name && columns.includes(name) ? [name] : [];
}

function propertyRead(node: ts.Node): string | undefined {
	if (!ts.isPropertyAccessExpression(node) || isAssignmentTarget(node)) return undefined;
	return runReceiver.test(node.expression.getText()) ? node.name.text : undefined;
}

function destructuredRead(node: ts.Node): string | undefined {
	if (!ts.isBindingElement(node) || !ts.isObjectBindingPattern(node.parent)) return undefined;
	const from = node.parent.parent;
	const source = ts.isVariableDeclaration(from) ? from.initializer?.getText() : undefined;
	return runReceiver.test(source ?? '') ? (node.propertyName ?? node.name).getText() : undefined;
}

/** SQL naming a column outside an INSERT list or a SET target reads it. */
function sqlReads(sql: string, columns: readonly string[]): string[] {
	if (!runTable.test(sql)) return [];
	const read = sql
		.replace(/INSERT\s+INTO\s+[\w.]+\s*\([^)]*\)/gi, ' ')
		.replace(/\bSET\b[\s\S]*?(?=\bWHERE\b|$)/g, (set) => set.replace(/\b\w+\s*=(?!=)/g, ' '))
		.replace(/'[^']*'/g, ' ');
	return columns.filter((column) =>
		new RegExp(`(?<![.\\w])(?:(?:r|runs|other)\\.)?${column}\\b(?!\\.)`).test(read)
	);
}

function isAssignmentTarget(node: ts.PropertyAccessExpression) {
	const { parent } = node;
	return (
		ts.isBinaryExpression(parent) &&
		parent.left === node &&
		parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
	);
}

function assignedName(node: ts.Node): string | undefined {
	if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node))
		return node.name.getText();
	if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left))
		return isAssignmentTarget(node.left) ? node.left.name.text : undefined;
	return undefined;
}
