import { createHash } from 'node:crypto';
import ts from 'typescript';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { Callable, Context } from './instrumentSource.types';
import { initializationEdits } from './moduleInitialization';
export type { Callable, Context, Edit } from './instrumentSource.types';

/** Source edits retain original bodies, call order and evaluation count. */
export function instrumentSource(
	source: string,
	path: string,
	unit: ComponentManifest
): string | null {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const suffix = createHash('sha256').update(path).digest('hex').slice(0, 12);
	let watch = `__harnessWatch_${suffix}`;
	while (source.includes(watch)) watch += '_';
	const context: Context = { file, unit, watch, method: `${watch}Method`, edits: [] };
	for (const statement of file.statements) instrumentStatement(context, statement);
	if (!context.edits.length) context.edits.push(...initializationEdits(file, unit, watch));
	if (!context.edits.length) return null;
	const runtime = new URL('./profileRuntime.ts', import.meta.url).href;
	const header = `\nimport { watchOperation as ${watch}, watchMethod as ${context.method}, beginSourceScope as ${watch}Begin } from ${JSON.stringify(runtime)};\n`;
	const start = source.startsWith('#!') ? source.indexOf('\n') + 1 : 0;
	context.edits.push({ start, end: start, text: header });
	return context.edits
		.sort((a, b) => b.start - a.start)
		.reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
}

function instrumentStatement(context: Context, statement: ts.Statement): void {
	if (ts.isFunctionDeclaration(statement) && statement.name) {
		const name = statement.name.text;
		if (!supported(context, statement, name)) return;
		context.edits.push({
			start: statement.end,
			end: statement.end,
			text: `\n${name} = ${context.watch}(${name}, ${metadata(context, statement, name)});`
		});
	} else if (ts.isVariableStatement(statement)) {
		for (const variable of statement.declarationList.declarations)
			instrumentVariable(context, variable);
	} else if (ts.isClassDeclaration(statement) && statement.name) {
		for (const member of statement.members) instrumentMethod(context, statement, member);
	}
}

function instrumentVariable(context: Context, variable: ts.VariableDeclaration): void {
	const value = variable.initializer;
	if (!value || !ts.isIdentifier(variable.name)) return;
	if (!ts.isArrowFunction(value) && !ts.isFunctionExpression(value)) return;
	const name = variable.name.text;
	if (!supported(context, value, name)) return;
	context.edits.push({
		start: value.getStart(context.file),
		end: value.end,
		text: `${context.watch}(${value.getText(context.file)}, ${metadata(context, value, name, name)})`
	});
}

function instrumentMethod(
	context: Context,
	owner: ts.ClassDeclaration,
	member: ts.ClassElement
): void {
	if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name) || !owner.name) return;
	const modifiers = ts.getCombinedModifierFlags(member);
	if (modifiers & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return;
	const name = `${owner.name.text}.${member.name.text}`;
	if (!supported(context, member, name)) return;
	const target = owner.name.text + (modifiers & ts.ModifierFlags.Static ? '' : '.prototype');
	context.edits.push({
		start: owner.end,
		end: owner.end,
		text: `\n${context.method}(${target}, ${JSON.stringify(member.name.text)}, ${metadata(context, member, name)});`
	});
}

function supported(context: Context, node: Callable, name: string): boolean {
	if (!node.body || ('asteriskToken' in node && node.asteriskToken)) return false;
	const output = context.unit.contract.outputs.find((item) => item.name === name);
	if (!output && !context.unit.owns.symbols.includes(name)) return false;
	const asynchronous = Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async);
	return asynchronous || !promiseReturn(output?.type, node.type, context.file);
}

function promiseReturn(
	output: string | undefined,
	type: ts.TypeNode | undefined,
	file: ts.SourceFile
): boolean {
	return /\bPromise(?:Like)?\s*</.test(output ?? type?.getText(file) ?? '');
}

function metadata(context: Context, node: Callable, name: string, inferredName?: string): string {
	const callable = context.unit.helperContracts?.find((item) => item.name === name)?.name;
	return JSON.stringify({
		unit: context.unit.id,
		operation: name,
		asynchronous: Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async),
		...(callable ? { callable } : {}),
		...(inferredName ? { inferredName } : {})
	});
}
