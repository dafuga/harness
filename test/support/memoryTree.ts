import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { SourceTree } from '../../src/core/sourceTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';
import {
	SourceIndexService,
	type SourceIndex
} from '../../src/services/source-index-service/SourceIndexService';
import {
	UnitIndexService,
	type UnitIndexResult
} from '../../src/services/unit-index-service/UnitIndexService';

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

export interface Indexed {
	index: SourceIndex;
	result: UnitIndexResult;
}

export async function indexFiles(
	files: Record<string, string>,
	existing: ComponentManifest[] = []
): Promise<Indexed> {
	const index = await new SourceIndexService().index(memoryTree(files), defaultUnitsConfig);
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
