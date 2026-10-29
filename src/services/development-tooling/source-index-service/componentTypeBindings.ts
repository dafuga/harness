import ts from 'typescript';
import type { ContractItem } from '../../../core/development-tooling/unitTypes';

export function importedBinding(file: ts.SourceFile, name: string) {
	for (const statement of file.statements) {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			const clause = statement.importClause;
			if (clause?.name?.text === name)
				return { name: 'default', specifier: statement.moduleSpecifier.text };
			const bindings = clause?.namedBindings;
			if (!bindings || !ts.isNamedImports(bindings)) continue;
			const binding = bindings.elements.find((item) => item.name.text === name);
			if (binding)
				return {
					name: binding.propertyName?.text ?? name,
					specifier: statement.moduleSpecifier.text
				};
		}
		if (
			ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			statement.exportClause &&
			ts.isNamedExports(statement.exportClause)
		) {
			const binding = statement.exportClause.elements.find((item) => item.name.text === name);
			if (binding)
				return {
					name: binding.propertyName?.text ?? name,
					specifier: statement.moduleSpecifier.text
				};
		}
	}
	return undefined;
}

export function selectedProps(
	items: ContractItem[],
	operator: string,
	keys: ts.TypeNode | undefined
): ContractItem[] {
	if (operator === 'Partial') return items.map((item) => ({ ...item, required: false }));
	if (operator === 'Required') return items.map((item) => ({ ...item, required: true }));
	const types = keys && ts.isUnionTypeNode(keys) ? keys.types : keys ? [keys] : [];
	const names = types.flatMap((type) =>
		ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? [type.literal.text] : []
	);
	if (!names.length) return [];
	return items.filter((item) => names.includes(item.name) === (operator === 'Pick'));
}
