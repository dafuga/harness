import ts from 'typescript';
import type { SourceFile, SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { ContractItem } from '../../../core/development-tooling/unitTypes';
import { scanImports } from './scanImports';
import {
	boundProps,
	componentSource,
	propMembers,
	propsDeclaration,
	propsType
} from './componentSyntax';
import { importedBinding, selectedProps } from './componentTypeBindings';

/** Resolve source-declared prop types in this snapshot, without a compiler host or runtime imports. */
export class ComponentPropsResolver {
	private readonly sources = new Map<string, Promise<ts.SourceFile>>();
	private readonly texts = new Map<string, string>();
	constructor(
		private readonly tree: SourceTree,
		private readonly files: Map<string, SourceFile>
	) {}

	async inputs(path: string, owner: string, seen = new Set<string>()): Promise<ContractItem[]> {
		const file = await this.source(path);
		const node = propsDeclaration(file);
		if (!node) return [];
		return boundProps(await this.members(path, propsType(node), seen), node, owner);
	}

	private async source(path: string): Promise<ts.SourceFile> {
		let pending = this.sources.get(path);
		if (!pending) {
			pending = this.tree.read(path).then((text) => {
				this.texts.set(path, text);
				return componentSource(text);
			});
			this.sources.set(path, pending);
		}
		return pending;
	}

	private async members(
		path: string,
		type: ts.TypeNode | undefined,
		seen: Set<string>
	): Promise<ContractItem[]> {
		if (!type || seen.size > 32) return [];
		const key = `${path}:${type.getText()}`;
		if (seen.has(key)) return [];
		const next = new Set([...seen, key]);
		if (ts.isParenthesizedTypeNode(type)) return this.members(path, type.type, next);
		if (ts.isTypeLiteralNode(type)) return propMembers(type.members);
		if (ts.isIntersectionTypeNode(type))
			return (await Promise.all(type.types.map((part) => this.members(path, part, next)))).flat();
		if (!ts.isTypeReferenceNode(type)) return [];
		return this.reference(path, type, next);
	}

	private async reference(
		path: string,
		type: ts.TypeReferenceNode,
		next: Set<string>
	): Promise<ContractItem[]> {
		const name = type.typeName.getText();
		if (
			name === 'ComponentProps' &&
			type.typeArguments?.[0] &&
			ts.isTypeQueryNode(type.typeArguments[0])
		) {
			const binding = await this.binding(path, type.typeArguments[0].exprName.getText());
			return binding
				? (await this.inputs(binding.path, '', next)).map((item) => ({
						...item,
						name: item.name.slice(1)
					}))
				: [];
		}
		if (['Partial', 'Required', 'Pick', 'Omit'].includes(name) && type.typeArguments?.[0])
			return selectedProps(
				await this.members(path, type.typeArguments[0], next),
				name,
				type.typeArguments[1]
			);
		return this.named(path, name, next);
	}

	private async named(path: string, name: string, seen: Set<string>): Promise<ContractItem[]> {
		const file = await this.source(path);
		const node = file.statements.find(
			(statement) =>
				(ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
				statement.name.text === name
		);
		if (node && ts.isTypeAliasDeclaration(node)) return this.members(path, node.type, seen);
		if (node && ts.isInterfaceDeclaration(node)) {
			const inherited = (
				await Promise.all(
					(node.heritageClauses ?? []).flatMap((clause) =>
						clause.types.map((base) => this.named(path, base.expression.getText(), seen))
					)
				)
			).flat();
			return [...inherited, ...propMembers(node.members)];
		}
		const binding = await this.binding(path, name);
		if (!binding || seen.has(`${binding.path}#${binding.name}`)) return [];
		return this.named(
			binding.path,
			binding.name,
			new Set([...seen, `${binding.path}#${binding.name}`])
		);
	}

	private async binding(path: string, name: string) {
		const file = await this.source(path);
		const imported = importedBinding(file, name);
		if (!imported) return undefined;
		const facts = this.files.get(path);
		const raw = scanImports(this.texts.get(path) ?? '', facts?.language ?? 'ts');
		const position = raw.findIndex((reference) => reference.specifier === imported.specifier);
		const target = facts?.references[position]?.path;
		return target ? { path: target, name: imported.name } : undefined;
	}
}

/** Enrichment happens after all files resolve; cached blob facts stay independent of other files. */
export async function resolveComponentProps(
	tree: SourceTree,
	files: Map<string, SourceFile>
): Promise<void> {
	const resolver = new ComponentPropsResolver(tree, files);
	for (const [path, file] of files) {
		if (file.language !== 'svelte') continue;
		const component = file.exports.find((symbol) => symbol.kind === 'component');
		if (!component) continue;
		const inputs = await resolver.inputs(path, component.name);
		if (inputs.length)
			file.exports = file.exports.map((symbol) =>
				symbol === component
					? { ...component, inputs: [...new Map(inputs.map((item) => [item.name, item])).values()] }
					: symbol
			);
	}
}
