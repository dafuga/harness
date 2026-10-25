import type { Indexed } from './memoryTree.types';
import { scanExports } from '../../src/utils/scanExports';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { SourceTree } from '../../src/core/sourceTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';
import { SourceIndexService } from '../../src/services/source-index-service/SourceIndexService';
import { UnitIndexService } from '../../src/services/unit-index-service/UnitIndexService';

export function memoryTree(files: Record<string, string>): SourceTree {
	return {
		revision: 'memory',
		list: () =>
			Promise.resolve(
				Object.entries(files).map(([path, contents]) => ({
					path,
					hash: createHash('sha1').update(contents).digest('hex')
				}))
			),
		read: (path) => Promise.resolve(files[path])
	};
}

export async function indexFiles(
	files: Record<string, string>,
	existing: ComponentManifest[] = [],
	config = defaultUnitsConfig
): Promise<Indexed> {
	const index = await new SourceIndexService().index(memoryTree(files), config);
	return { index, result: new UnitIndexService().index(index, existing) };
}

export function unitOf(indexed: Indexed, id: string): ComponentManifest {
	const unit = indexed.result.manifests.find((manifest) => manifest.id === id);
	if (!unit) throw new Error(`Unit ${id} was not indexed.`);
	return unit;
}

export function retire(unit: ComponentManifest): ComponentManifest {
	return { ...unit, status: 'retired', retired: { reason: 'Removed', at: '2026-10-10T00:00:00Z' } };
}

/** A formatting-independent fingerprint for source ownership moves. */
export function movedDefinition(path: string, name: string): string {
	const code = readFileSync(path, 'utf8');
	const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
	const node = source.statements.find((item) => {
		if (ts.isFunctionDeclaration(item)) return item.name?.text === name;
		return (
			ts.isVariableStatement(item) &&
			item.declarationList.declarations.some(
				(declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
			)
		);
	});
	if (!node) return 'definition absent';
	const text = node
		.getText(source)
		.replace(/^export\s+(?:default\s+)?/, '')
		.replace(
			/new URL\((['"])(\.[^'"]*)\1,\s*import\.meta\.url\)/g,
			(_match, quote: string, value: string) =>
				`new URL(${quote}${posix.normalize(posix.join(posix.dirname(path), value))}${quote}, import.meta.url)`
		);
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
	const tokens: string[] = [];
	let token;
	while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
		const value =
			token === ts.SyntaxKind.StringLiteral ? scanner.getTokenValue() : scanner.getTokenText();
		tokens.push(`${token}:${value}`);
	}
	return createHash('sha256').update(tokens.join('\0')).digest('hex');
}

/** Canonical source tokens keep relocation proof independent of import spelling. */
export function relocatedSource(
	path: string,
	moves: Record<string, string>,
	code = readFileSync(path, 'utf8')
): string {
	const reverse = new Map(Object.entries(moves).map(([from, to]) => [to, from]));
	const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
	const text = source.statements
		.filter((node) => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
		.map((node) => node.getText(source))
		.join('\n')
		.replace(
			/new URL\((['"])(\.[^'"]*)\1,\s*import\.meta\.url\)/g,
			(match, quote: string, specifier: string) => {
				// Bundled-output addresses remain output-relative rather than source-relative.
				if (specifier.endsWith('.js')) return match;
				const target = posix.normalize(posix.join(posix.dirname(path), specifier));
				return `new URL(${quote}${reverse.get(target) ?? target}${quote}, import.meta.url)`;
			}
		);
	const parsed = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const tokens: string[] = [];
	const visit = (node: ts.Node) => {
		tokens.push(String(node.kind));
		if (node.kind <= ts.SyntaxKind.LastToken && 'text' in node) tokens.push(String(node.text));
		if (ts.isVariableDeclarationList(node))
			tokens.push(String(node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)));
		ts.forEachChild(node, visit);
	};
	visit(parsed);
	return createHash('sha256').update(tokens.join('\0')).digest('hex');
}

export function helperMoveGaps(
	root: string,
	moves: Array<{ unit: string; name: string; to: string; ownerSource: string; definition: string }>,
	followUps: Array<{
		unit: string;
		name: string;
		definition: string;
		to?: string;
		ownerSource?: string;
	}>
): string[] {
	const gaps: string[] = [];
	for (const move of moves) {
		const current = {
			...move,
			...followUps.find((item) => item.unit === move.unit && item.name === move.name)
		};
		const location = current.to;
		const owner = current.ownerSource;
		const target = resolve(root, location);
		if (!existsSync(target)) {
			gaps.push(`${move.name}: owner-local source is missing`);
			continue;
		}
		if (posix.dirname(location) !== posix.dirname(owner))
			gaps.push(`${move.name}: different owner folder`);
		if (!existsSync(resolve(root, owner))) gaps.push(`${move.name}: owner source is missing`);
		if (movedDefinition(location, move.name) !== current.definition)
			gaps.push(`${move.name}: definition changed`);
		const unit = JSON.parse(
			readFileSync(resolve(root, `specification/units/${move.unit}.json`), 'utf8')
		) as ComponentManifest;
		if (unit.id !== move.unit || !unit.owns.source.includes(location))
			gaps.push(`${move.name}: registered identity lost`);
	}

	return gaps;
}

export function serviceMoveGaps(services: {
	moves: Record<string, string>;
	files: Array<{ to: string; unit: string; definition: string }>;
	services: Array<{ id: string; ownerFolder: string }>;
}): string[] {
	const gaps: string[] = [];
	for (const file of services.files) {
		if (!existsSync(file.to)) {
			gaps.push(`${file.to}: missing`);
			continue;
		}
		if (relocatedSource(file.to, services.moves) !== file.definition)
			gaps.push(`${file.to}: definition changed`);
		const unit = JSON.parse(
			readFileSync(`specification/units/${file.unit}.json`, 'utf8')
		) as ComponentManifest;
		if (!unit.owns.source.includes(file.to)) gaps.push(`${file.unit}: identity lost`);
	}
	for (const service of services.services) {
		const unit = JSON.parse(
			readFileSync(`specification/units/${service.id}.json`, 'utf8')
		) as ComponentManifest;
		if (
			unit.owns.source.some(
				(path) =>
					!path.startsWith(service.ownerFolder + '/') &&
					scanExports(readFileSync(path, 'utf8')).symbols.some((symbol) =>
						['class', 'function', 'const'].includes(symbol.kind)
					)
			)
		)
			gaps.push(`${service.id}: outside owner`);
	}
	return gaps;
}

export type { Indexed } from './memoryTree.types';
