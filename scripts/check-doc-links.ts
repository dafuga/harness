// @harness-uid u_ty3of47ntv
/** Cheap standing guard: relative links in the checked documents must lead somewhere. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/** Documents checked on every run; Markdown files they link are checked too. */
export const checkedDocuments = ['ARCHITECTURE-BOUNDARIES.md', 'README.md'];

/** Documents whose backticked repository paths must also exist: they map owners to files. */
export const pathCheckedDocuments = ['ARCHITECTURE-BOUNDARIES.md'];

import type { DocLink, DocFiles } from './check-doc-links.types';

function withoutCode(line: string): string {
	return line.replace(/`[^`]*`/g, (code) => ' '.repeat(code.length));
}

/** Inline `[text](target)` links outside fenced blocks and inline code. */
export function markdownLinks(source: string): DocLink[] {
	const links: DocLink[] = [];
	let fenced = false;
	for (const [index, line] of source.split('\n').entries()) {
		if (/^\s*(```|~~~)/.test(line)) {
			fenced = !fenced;
			continue;
		}
		if (fenced) continue;
		for (const match of withoutCode(line).matchAll(/\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g))
			links.push({ line: index + 1, target: match[1]! });
	}
	return links;
}

/** Backticked source paths such as `src/core/files.ts`, outside fenced blocks. */
export function codePaths(source: string): DocLink[] {
	const paths: DocLink[] = [];
	let fenced = false;
	for (const [index, line] of source.split('\n').entries()) {
		if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
		if (fenced) continue;
		for (const match of line.matchAll(/`((?:src|test|scripts|packages|crates)\/[\w./-]+\.\w+)`/g))
			paths.push({ line: index + 1, target: match[1]! });
	}
	return paths;
}

/** Heading anchors as GitHub renders them, with `-1`, `-2` suffixes for repeats. */
export function headingAnchors(source: string): Set<string> {
	const anchors = new Set<string>();
	const seen = new Map<string, number>();
	let fenced = false;
	for (const line of source.split('\n')) {
		if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
		const heading = fenced ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
		if (!heading) continue;
		const slug = heading[1]!
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s_-]/gu, '')
			.replace(/\s/g, '-');
		const repeats = seen.get(slug) ?? 0;
		seen.set(slug, repeats + 1);
		anchors.add(repeats ? `${slug}-${repeats}` : slug);
	}
	return anchors;
}

function decoded(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

/** One line per broken link. External URLs are not fetched; this check stays offline. */
export function brokenDocLinks(
	documents: readonly string[],
	files: DocFiles,
	pathChecked: readonly string[] = []
): string[] {
	const problems: string[] = [];
	const pending = [...documents];
	const traversal = { pending, problems };
	const checked = new Set<string>();
	while (pending.length) {
		const document = pending.shift()!;
		if (checked.has(document)) continue;
		checked.add(document);
		if (!files.exists(document)) {
			problems.push(`${document}: checked document does not exist`);
			continue;
		}
		const source = files.read(document);
		for (const { line, target } of pathChecked.includes(document) ? codePaths(source) : [])
			if (!files.exists(target)) problems.push(`${document}:${line}: \`${target}\` does not exist`);
		for (const link of markdownLinks(source)) checkMarkdownLink(document, link, files, traversal);
	}
	return problems.sort();
}

function checkMarkdownLink(
	document: string,
	{ line, target }: DocLink,
	files: DocFiles,
	{ pending, problems }: { pending: string[]; problems: string[] }
): void {
	if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return;
	const [file = '', anchor] = target.split('#', 2);
	const path = resolveDocPath(document, file);
	if (path.startsWith('..')) {
		problems.push(`${document}:${line}: ${target} leaves the repository`);
		return;
	}
	if (!files.exists(path)) {
		problems.push(`${document}:${line}: ${target} does not exist`);
		return;
	}
	if (!path.endsWith('.md')) return;
	if (anchor && !headingAnchors(files.read(path)).has(decoded(anchor).toLowerCase()))
		problems.push(`${document}:${line}: ${target} has no such heading`);
	if (path !== document) pending.push(path);
}

function resolveDocPath(document: string, file: string): string {
	if (!file) return document;
	return normalize(file.startsWith('/') ? file.slice(1) : join(dirname(document), decoded(file)));
}

function main(): void {
	const files = { exists: existsSync, read: (path: string) => readFileSync(path, 'utf8') };
	const problems = brokenDocLinks(checkedDocuments, files, pathCheckedDocuments);
	for (const problem of problems) console.error(`Broken document link: ${problem}`);
	if (problems.length) process.exitCode = 1;
	else console.log(`Document links resolve from ${checkedDocuments.join(' and ')}.`);
}

if (import.meta.main) main();
