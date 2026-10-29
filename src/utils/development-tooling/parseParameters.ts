import type { ContractItem } from '../../core/development-tooling/unitTypes';
import ts from 'typescript';
import { parameterDefault, parameterType } from './parameterDefaults';

const openers = new Set(['(', '[', '{', '<']);
const closers = new Set([')', ']', '}']);

/** Splits text on separators that are not nested inside brackets or generics. */
export function splitTopLevel(masked: string, separators: string): number[] {
	const cuts: number[] = [];
	let depth = 0;
	for (let index = 0; index < masked.length; index += 1) {
		const char = masked[index];
		if (openers.has(char)) depth += 1;
		else if (closers.has(char) || (char === '>' && masked[index - 1] !== '=')) depth -= 1;
		else if (depth === 0 && separators.includes(char)) cuts.push(index);
	}
	return cuts;
}

/** Reads `name: type` pairs from a parameter list or an object type literal. */
export function parseParameters(
	code: string,
	_masked: string,
	options: { owner: string; separators?: string }
): ContractItem[] {
	const properties = options.separators?.includes(';');
	const text = properties ? `type Input = {${code}}` : `function input(${code}) {}`;
	const file = ts.createSourceFile('parameters.ts', text, ts.ScriptTarget.Latest, true);
	const declaration = file.statements[0];
	if (ts.isFunctionDeclaration(declaration))
		return declaration.parameters.flatMap((item) => parameterItems(item, options.owner));
	if (ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type))
		return declaration.type.members.flatMap((item) =>
			ts.isPropertySignature(item) ? [propertyItem(item, options.owner)] : []
		);
	return [];
}

function parameterItems(node: ts.ParameterDeclaration, owner: string): ContractItem[] {
	if (ts.isObjectBindingPattern(node.name)) {
		const members = node.type && ts.isTypeLiteralNode(node.type) ? node.type.members : [];
		return node.name.elements.flatMap((binding) => {
			const name = binding.propertyName?.getText() ?? binding.name.getText();
			const property = members.find((item) => item.name?.getText() === name);
			const type =
				property && ts.isPropertySignature(property) ? property.type?.getText() : undefined;
			return [
				{
					name: `${owner}.${name}`,
					type: normalizeType(type ?? parameterType(binding.initializer)),
					required:
						!binding.initializer &&
						!node.initializer &&
						!(property && 'questionToken' in property && property.questionToken),
					...parameterDefault(binding.initializer)
				}
			];
		});
	}
	return [
		{
			name: `${owner}.${node.name.getText()}`,
			type: normalizeType(node.type?.getText() ?? parameterType(node.initializer)),
			required: !node.questionToken && !node.initializer && !node.dotDotDotToken,
			...parameterDefault(node.initializer)
		}
	];
}

function propertyItem(node: ts.PropertySignature, owner: string): ContractItem {
	const name = ts.isStringLiteralLike(node.name) ? node.name.text : node.name.getText();
	return {
		name: `${owner}.${name}`,
		type: normalizeType(node.type?.getText() ?? ''),
		required: !node.questionToken
	};
}

export function normalizeType(text: string): string {
	const type = text.replace(/\s+/g, ' ').trim().replace(/[;,]$/, '').trim();
	return type || 'unknown';
}
