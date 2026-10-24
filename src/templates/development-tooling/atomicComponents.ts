import type { PlannedFile } from '../../core/development-tooling/files';
import { nativeAtoms, nativeAtomSource, atomTag, htmlElements } from './htmlElements.js';
import { atomicRuntimeSources } from './atomicRuntimeSources';
export { nativeAtomSource } from './htmlElements.js';

/** Native atoms have no extra DOM, styles or behavior; composed controls own those concerns. */
export function atomicComponentFiles(): PlannedFile[] {
	return [
		...nativeAtoms.map((atom) => ({
			path: `src/components/atoms/${atom.name}.svelte`,
			contents: nativeAtomSource(atom)
		})),
		...atomicTypeFiles(),
		...Object.entries(atomicRuntimeSources).map(([name, contents]) => ({
			path: 'scripts/' + name,
			contents
		}))
	];
}

export function atomicTypeFiles(): PlannedFile[] {
	const fields = nativeAtoms
		.map(
			(atom) =>
				`\t\t'${atomTag(atom)}': NativeElements['${atom.tag === 'svelte:element' ? 'div' : atom.tag}']${atom.tag === 'svelte:element' ? ' & { this?: string }' : ''};`
		)
		.join('\n');
	const dom = nativeAtoms
		.map(
			(atom) =>
				`\t\t'${atomTag(atom)}': ${atom.tag === 'svelte:element' ? 'HTMLElement' : `${htmlElements.includes(atom.tag) ? 'HTMLElement' : 'SVGElement'}TagNameMap['${atom.tag}']`};`
		)
		.join('\n');
	return [
		{
			path: 'src/lib/atoms/native-elements.d.ts',
			contents: `import type { SvelteHTMLElements as NativeElements } from 'svelte/elements';\n\ndeclare module 'svelte/elements' {\n\tinterface SvelteHTMLElements {\n${fields}\n\t}\n}\n`
		},
		{
			path: 'src/lib/atoms/native-dom.d.ts',
			contents: `export {};\n\ndeclare global {\n\tinterface HTMLElementTagNameMap {\n${dom}\n\t}\n}\n`
		}
	];
}
