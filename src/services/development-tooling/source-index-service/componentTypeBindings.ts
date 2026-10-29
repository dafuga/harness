import ts from 'typescript';
import type { ContractItem } from '../../../core/development-tooling/unitTypes';

export function importedBinding(file: ts.SourceFile, name: string) {
	for (const statement of file.statements) {
		const imported = ts.isImportDeclaration(statement) ? importBinding(statement, name) : undefined;
		if (imported) return imported;
		const exported = ts.isExportDeclaration(statement) ? exportBinding(statement, name) : undefined;
		if (exported) return exported;
	}
	return undefined;
}

function importBinding(statement: ts.ImportDeclaration, name: string) {
	if (!ts.isStringLiteral(statement.moduleSpecifier)) return undefined;
	const clause = statement.importClause;
	if (clause?.name?.text === name)
		return { name: 'default', specifier: statement.moduleSpecifier.text };
	return namedImport(clause?.namedBindings, name, statement.moduleSpecifier.text);
}

function namedImport(
	bindings: ts.NamedImportBindings | undefined,
	name: string,
	specifier: string
) {
	if (!bindings || !ts.isNamedImports(bindings)) return undefined;
	const binding = bindings.elements.find((item) => item.name.text === name);
	return binding ? { name: binding.propertyName?.text ?? name, specifier } : undefined;
}

function exportBinding(statement: ts.ExportDeclaration, name: string) {
	if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier))
		return undefined;
	if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return undefined;
	const binding = statement.exportClause.elements.find((item) => item.name.text === name);
	return binding
		? { name: binding.propertyName?.text ?? name, specifier: statement.moduleSpecifier.text }
		: undefined;
}

export function selectedProps(
	items: ContractItem[],
	operator: string,
	keys: ts.TypeNode | undefined
): ContractItem[] {
	if (operator === 'Partial') return items.map((item) => ({ ...item, required: false }));
	if (operator === 'Required') return items.map((item) => ({ ...item, required: true }));
	if (!keys) return [];
	const types = ts.isUnionTypeNode(keys) ? keys.types : [keys];
	const names = types.flatMap((type) =>
		ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? [type.literal.text] : []
	);
	if (!names.length) return [];
	return items.filter((item) => names.includes(item.name) === (operator === 'Pick'));
}
