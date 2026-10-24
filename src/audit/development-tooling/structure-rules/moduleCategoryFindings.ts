import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { relative, resolve } from 'node:path';
import { ModuleCategoryService } from '../../../services/development-tooling/ModuleCategoryService';
import { moduleGroup, modulePath } from '../../../utils/development-tooling/moduleGroup';
import type { AuditStructure } from '../adapters/types';
import type { AuditFinding } from '../types';

/** Category adoption enforces real folders while preserving named framework/public entries. */
export function moduleCategoryFindings(structure: AuditStructure): AuditFinding[] {
	if (!structure.root) return [];
	const loaded = new ModuleCategoryService().load(structure.root);
	if (!loaded) return [];
	return structure.files.flatMap((path) => {
		if (!/\.(?:[cm]?[jt]sx?|svelte)$/.test(path)) return [];
		const owned = relative(loaded.root, resolve(structure.root!, path));
		const source = modulePath(owned);
		if (!source || preservedEntry(owned)) return [];
		if (loaded.config.legacy.includes(owned) && forwardingEntry(resolve(structure.root!, path)))
			return [];
		if (moduleGroup([owned], loaded.config.groups)) return [];
		return [
			{
				path,
				rule: 'module-category-folder',
				message:
					'Place this implementation in a declared responsibility category folder; use harness generate --group <category>.'
			}
		];
	});
}

function preservedEntry(path: string): boolean {
	return (
		/(?:^|\/)src\/lib\/atoms\/native-(?:elements|dom)\.d\.ts$/.test(path) ||
		/(?:^|\/)src\/routes\//.test(path) ||
		/(?:^|\/)src\/components\/atoms\//.test(path) ||
		/(?:^|\/)src\/models\/adapters\//.test(path) ||
		/(?:^|\/)src\/lib\/(?:styles|assets)\//.test(path)
	);
}

function forwardingEntry(path: string): boolean {
	const text = readFileSync(path, 'utf8');
	if (!path.endsWith('.svelte')) return forwardingScript(text, false);
	const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
	const isModule = (attributes: string) =>
		/(?:^|\s)(?:module(?:\s|$)|context\s*=\s*['"]module['"])/.test(attributes);
	const instance = scripts.filter((script) => !isModule(script[1]));
	const modules = scripts.filter((script) => isModule(script[1]));
	const markup = text
		.replace(/^<!-- @harness-(?:tier|atoms) [^\n]* -->\n/gm, '')
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
		.trim();
	return (
		instance.length === 1 &&
		modules.length <= 1 &&
		/^<CategoryImplementation\s+\{\.\.\.props\}(?:\s+bind:[A-Za-z_$][\w$]*)*\s*\/>$/.test(markup) &&
		forwardingScript(instance[0][2], true) &&
		modules.every((script) => forwardingScript(script[2], false))
	);
}

function forwardingScript(text: string, props: boolean): boolean {
	const source = ts.createSourceFile('entry.ts', text, ts.ScriptTarget.Latest, true);
	return (
		source.statements.length > 0 &&
		source.statements.every(
			(node) =>
				ts.isImportDeclaration(node) ||
				(props ? propsDeclaration(node) : ts.isExportDeclaration(node))
		)
	);
}

function propsDeclaration(node: ts.Statement): boolean {
	return (
		ts.isVariableStatement(node) &&
		node.declarationList.declarations.every((declaration) => {
			const call = declaration.initializer;
			return (
				call !== undefined &&
				ts.isCallExpression(call) &&
				ts.isIdentifier(call.expression) &&
				call.expression.text === '$props' &&
				call.arguments.length === 0
			);
		})
	);
}
