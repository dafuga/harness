import { extname } from 'node:path';
import type {
	ExportedSymbol,
	ResolvedReference,
	SourceFile,
	SourceTree,
	TreeEntry
} from '../core/sourceTypes';
import type { UnitsConfig } from '../core/unitsConfig';
import { classifyPath, type PathClass } from '../utils/classifyPath';
import { resolveImport } from '../utils/resolveImport';
import { scanComponent } from '../utils/scanComponent';
import { scanExports } from '../utils/scanExports';
import { scanImports, type SourceLanguage, type SourceReference } from '../utils/scanImports';
import { sourceBlocks, type SourceBlock } from '../utils/sourceBlocks';

export interface SourceIndex {
	revision: string;
	/** Indexed files by repository-relative path; ignored files are absent. */
	files: Map<string, SourceFile>;
}

interface Parsed {
	bytes: number;
	lines: number;
	references: SourceReference[];
	blocks: SourceBlock[];
	exports: ExportedSymbol[];
	errors: string[];
}

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

const empty: Parsed = { bytes: 0, lines: 0, references: [], blocks: [], exports: [], errors: [] };

function parseText(code: string, language: SourceLanguage, path: string): Parsed {
	const scan = exportsOf(code, language, path);
	return {
		bytes: Buffer.byteLength(code),
		lines: code.split('\n').length - (code.endsWith('\n') ? 1 : 0),
		references: scanImports(code, language),
		blocks: sourceBlocks(code, language),
		exports: scan.symbols,
		errors: scan.errors
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
