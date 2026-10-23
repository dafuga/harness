import type { SourceIndex, Parsed } from './SourceIndexService.types';
export type { SourceIndex, Parsed } from './SourceIndexService.types';
import { extname } from 'node:path';
import type {
	ResolvedReference,
	SourceFile,
	SourceTree,
	TreeEntry
} from '../../../core/development-tooling/sourceTypes';
import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import {
	classifyPath,
	type PathClass
} from '../../../utils/accounts-access/classify-path/classifyPath';
import { resolveImport } from '../../../utils/development-tooling/resolveImport';
import { scanExports } from '../../../utils/development-tooling/scanExports';
import {
	type SourceLanguage,
	type SourceReference
} from '../../../utils/development-tooling/scanImports';

import { complexityCoverage } from './complexityCoverage';
import { scanComponent } from './scanComponent';
import { scanImports } from './scanImports';
import { sourceBlocks } from './sourceBlocks';
import { sourceExecution } from './sourceExecution';

const languages: Record<string, SourceLanguage> = {
	'.ts': 'ts',
	'.tsx': 'ts',
	'.js': 'ts',
	'.jsx': 'ts',
	'.mjs': 'ts',
	'.cjs': 'ts',
	'.svelte': 'svelte',
	'.css': 'css'
};

const textExtensions = new Set(['.py', '.sh', '.sql', '.html', '.rs', '.toml', '.json', '.yml']);

/** Scans a source tree into per-file facts, reusing work for blobs it has already parsed. */
export class SourceIndexService {
	private readonly parsed = new Map<string, Parsed>();

	async index(tree: SourceTree, config: UnitsConfig): Promise<SourceIndex> {
		const entries = await tree.list();
		const paths = new Set(entries.map((entry) => entry.path));
		const files = await Promise.all(
			entries.map((entry) => this.file(tree, entry, { config, paths }))
		);
		const kept = files.filter((file): file is SourceFile => file !== undefined);
		return { revision: tree.revision, files: new Map(kept.map((file) => [file.path, file])) };
	}

	private async file(
		tree: SourceTree,
		entry: TreeEntry,
		context: { config: UnitsConfig; paths: Set<string> }
	): Promise<SourceFile | undefined> {
		const placed = classifyPath(entry.path, context.config);
		if (placed.classification === 'ignored') return undefined;
		const language = languages[extname(entry.path).toLowerCase()] ?? 'other';
		const parsed = await this.parse(tree, entry, language);
		return {
			path: entry.path,
			hash: entry.hash,
			bytes: parsed.bytes,
			lines: parsed.lines,
			language,
			read: parsed.read,
			execution: parsed.execution,
			decisions: parsed.read ? complexityCoverage(entry.path, parsed.scripted) : 'unsupported',
			classification: placed.classification,
			workspace: placed.workspace,
			identity: placed.identity,
			references: parsed.references.map((reference) =>
				resolve(entry.path, reference, { placed, ...context })
			),
			blocks: parsed.blocks,
			exports: parsed.exports,
			errors: parsed.errors
		};
	}

	private async parse(
		tree: SourceTree,
		entry: TreeEntry,
		language: SourceLanguage
	): Promise<Parsed> {
		const key = `${entry.hash}:${language}:${componentName(entry.path)}`;
		const cached = this.parsed.get(key);
		if (cached) return cached;
		const readable = language !== 'other' || textExtensions.has(extname(entry.path).toLowerCase());
		const parsed = readable ? parseText(await tree.read(entry.path), language, entry.path) : empty;
		this.parsed.set(key, parsed);
		return parsed;
	}
}

const empty: Parsed = {
	execution: 'unknown',
	bytes: 0,
	lines: 0,
	references: [],
	blocks: [],
	exports: [],
	errors: [],
	read: false,
	scripted: false
};

function parseText(code: string, language: SourceLanguage, path: string): Parsed {
	const scan = exportsOf(code, language, path);
	return {
		execution: sourceExecution(code, language, path),
		bytes: Buffer.byteLength(code),
		lines: code.split('\n').length - (code.endsWith('\n') ? 1 : 0),
		references: scanImports(code, language),
		blocks: sourceBlocks(code, language),
		exports: scan.symbols,
		errors: scan.errors,
		read: true,
		scripted: language === 'other' && /<script\b/i.test(code)
	};
}

function exportsOf(code: string, language: SourceLanguage, path: string) {
	if (language === 'ts') return scanExports(code);
	if (language === 'svelte') return scanComponent(code, componentName(path));
	return { symbols: [], errors: [] };
}

function componentName(path: string): string {
	return path.endsWith('.svelte') ? (path.split('/').at(-1)?.replace('.svelte', '') ?? '') : '';
}

function resolve(
	from: string,
	reference: SourceReference,
	context: { placed: PathClass; config: UnitsConfig; paths: Set<string> }
): ResolvedReference {
	const declared = context.config.references.find(
		(entry) => entry.from === from && entry.specifier === (reference.specifier ?? reference.detail)
	);
	const base = { via: reference.via, typeOnly: reference.typeOnly };
	if (declared?.to) return { ...base, path: declared.to };
	if (declared) return { ...base, external: declared.external ?? 'declared' };
	return resolveImport(from, reference, {
		files: context.paths,
		workspaceRoot: context.placed.workspaceRoot
	});
}
