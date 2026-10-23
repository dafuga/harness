import ts from 'typescript';
import type { SourceFile } from '../../../core/development-tooling/sourceTypes';
import type { SourceLanguage } from '../../../utils/development-tooling/scanImports';
/** Only inspected declarations can omit runtime profiling; exported types alone prove nothing. */
export function sourceExecution(
	code: string,
	language: SourceLanguage,
	path: string
): NonNullable<SourceFile['execution']> {
	if (language === 'css') return 'declarative';
	if (language !== 'ts') return 'unknown';
	const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
	const diagnostics = (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
		.parseDiagnostics;
	if (diagnostics.length) return 'unknown';
	return file.statements.every(declarationOnly) ? 'declarative' : 'runtime';
}

function declarationOnly(node: ts.Statement): boolean {
	if (
		[
			ts.isInterfaceDeclaration(node),
			ts.isTypeAliasDeclaration(node),
			ts.isEmptyStatement(node)
		].some(Boolean)
	)
		return true;
	if (
		ts.isDeclarationStatement(node) &&
		(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Ambient) !== 0
	)
		return true;
	if (ts.isImportDeclaration(node)) return typeOnlyImport(node.importClause);
	if (!ts.isExportDeclaration(node)) return false;
	if (node.isTypeOnly) return true;
	const named = node.exportClause;
	return (
		!node.moduleSpecifier &&
		Boolean(named && ts.isNamedExports(named) && named.elements.every((item) => item.isTypeOnly))
	);
}

function typeOnlyImport(clause: ts.ImportClause | undefined): boolean {
	if (!clause) return false;
	if (clause.isTypeOnly) return true;
	const named = clause.namedBindings;
	return (
		!clause.name &&
		Boolean(
			named &&
			ts.isNamedImports(named) &&
			named.elements.length > 0 &&
			named.elements.every((item) => item.isTypeOnly)
		)
	);
}
