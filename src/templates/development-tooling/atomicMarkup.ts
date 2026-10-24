import { posix } from 'node:path';
import { atomicSyntax, walkAtomicMarkup } from './atomicSyntax.js';
import { atomTag, nativeAtoms } from './htmlElements.js';
import type { PlannedFile } from '../../core/development-tooling/files';

export function atomicProjectFiles(files: PlannedFile[]): PlannedFile[] {
	return files.map((file) => ({
		...file,
		contents:
			file.path.endsWith('.svelte') && !file.path.includes('/atoms/')
				? atomicMarkup(
						file.contents,
						file.path,
						file.path.endsWith('+layout.svelte') ? 'layout' : 'page'
					)
				: file.contents
	}));
}

/** Generate native atom calls without changing attributes, expressions, bindings or CSS. */
export function atomicMarkup(source: string, path: string, level: string): string {
	const syntax = atomicSyntax(source);
	const edits: Array<{ start: number; end: number; text: string }> = [];
	walkAtomicMarkup(syntax.tree.fragment, (node) => {
		if (!['RegularElement', 'SvelteElement'].includes(String(node.type))) return;
		const atom = nativeAtoms.find((candidate) => candidate.tag === node.name && !candidate.type);
		if (!atom) return;
		const start = Number(node.start),
			end = Number(node.end),
			name = String(node.name);
		edits.push({ start: start + 1, end: start + 1 + name.length, text: atomTag(atom) });
		const close = source.lastIndexOf('</' + name, end - 1);
		if (close > start)
			edits.push({ start: close + 2, end: close + 2 + name.length, text: atomTag(atom) });
	});
	for (const edit of edits.sort((left, right) => right.start - left.start))
		source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
	const directory = posix.relative(posix.dirname(path), 'src/components/atoms');
	source = source.replace(/^<!-- @harness-(?:tier|atoms) .*? -->\n/gm, '');
	return `<!-- @harness-tier ${level} -->\n<!-- @harness-atoms ${directory.startsWith('.') ? directory : './' + directory} -->\n${source}`;
}
