import ts from 'typescript';
import type { ModelDefinition } from '../../../utils/explorer-ui/unitMetadata';
import { modelTable } from './modelTable';

/** Inspect public declarations without importing model code or accessing a database. */
export function modelDefinitions(text: string, source: string): ModelDefinition[] {
	const file = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	return file.statements.flatMap((node) => {
		if (!declaration(node) || !node.name || !exported(node)) return [];
		const members = membersOf(node);
		const kind = modelKind(node);
		const fields = members.flatMap(fieldOf);
		const methods = members.flatMap(methodOf);
		const type =
			ts.isTypeAliasDeclaration(node) && !ts.isTypeLiteralNode(node.type)
				? node.type.getText(file)
				: undefined;
		return [
			{
				name: node.name.text,
				kind,
				source,
				fields,
				methods,
				...(type ? { type } : {}),
				...(ts.isClassDeclaration(node) ? modelTable(node, file) : {})
			}
		];
	});
}

function modelKind(node: ts.Node): ModelDefinition['kind'] {
	if (ts.isClassDeclaration(node)) return 'class';
	if (ts.isInterfaceDeclaration(node)) return 'interface';
	return 'type';
}

function declaration(
	node: ts.Node
): node is ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration {
	return (
		ts.isClassDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node)
	);
}

function exported(node: ts.Declaration): boolean {
	return (
		ts.canHaveModifiers(node) &&
		Boolean(ts.getModifiers(node)?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword))
	);
}

function membersOf(
	node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration
): readonly (ts.ClassElement | ts.TypeElement)[] {
	if (ts.isTypeAliasDeclaration(node))
		return ts.isTypeLiteralNode(node.type) ? node.type.members : [];
	return node.members;
}

function hidden(node: ts.Node): boolean {
	return (
		ts.canHaveModifiers(node) &&
		Boolean(
			ts
				.getModifiers(node)
				?.some(
					(item) =>
						item.kind === ts.SyntaxKind.PrivateKeyword ||
						item.kind === ts.SyntaxKind.ProtectedKeyword
				)
		)
	);
}

function nameOf(name: ts.PropertyName | ts.BindingName | undefined): string | undefined {
	if (!name || ts.isPrivateIdentifier(name)) return undefined;
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

function fieldOf(member: ts.ClassElement | ts.TypeElement): ModelDefinition['fields'] {
	if (hidden(member) || (!ts.isPropertyDeclaration(member) && !ts.isPropertySignature(member)))
		return [];
	if (
		ts.canHaveModifiers(member) &&
		ts.getModifiers(member)?.some((item) => item.kind === ts.SyntaxKind.StaticKeyword)
	)
		return [];
	const name = nameOf(member.name);
	return name
		? [{ name, type: member.type?.getText() ?? 'unknown', optional: Boolean(member.questionToken) }]
		: [];
}

function methodOf(member: ts.ClassElement | ts.TypeElement): ModelDefinition['methods'] {
	if (hidden(member)) return [];
	if (
		!ts.isMethodDeclaration(member) &&
		!ts.isMethodSignature(member) &&
		!ts.isConstructorDeclaration(member)
	)
		return [];
	const constructor = ts.isConstructorDeclaration(member);
	const name = constructor ? 'constructor' : nameOf(member.name);
	if (!name) return [];
	const inputs = member.parameters.map((parameter) => ({
		name: `${parameter.dotDotDotToken ? '...' : ''}${parameter.name.getText()}${parameter.questionToken ? '?' : ''}`,
		type: parameter.type?.getText() ?? 'unknown'
	}));
	return [{ name, inputs, output: constructor ? 'void' : (member.type?.getText() ?? 'unknown') }];
}
