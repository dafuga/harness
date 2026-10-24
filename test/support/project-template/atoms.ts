import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from 'svelte/compiler';
import { expect } from 'vitest';
import { atomicComponents } from '../../../src/templates/development-tooling/atomicPreprocess.js';
import { atomicMarkup } from '../../../src/templates/development-tooling/atomicMarkup';
import { nativeAtoms } from '../../../src/templates/development-tooling/htmlElements.js';
import { atomicRuntimeSources } from '../../../src/templates/development-tooling/atomicRuntimeSources';
import { projectFiles } from '../../../src/templates/project';
import { measureWorkload } from '../measureWorkload';

const native = `<script lang="ts">
 let value = $state('first'), checked = $state(false), group = $state(['one']);
 let files = $state<FileList>(), button: HTMLButtonElement, dialog: HTMLDialogElement;
 let heading: 'h2' | 'h3' = 'h2';
 function ready(node: HTMLElement) { node.dataset.ready = 'yes'; return { destroy() { delete node.dataset.ready; } }; }
</script>
<form onsubmit={(event) => event.preventDefault()}>
 <label>Value<input type="text" bind:value required disabled={false} use:ready /></label>
 <input type="checkbox" bind:checked aria-label="Enabled" />
 <input type="checkbox" bind:group value="one" aria-label="One" />
 <input type="file" bind:files aria-label="Attachment" />
 <select bind:value aria-label="Choice"><option value="first">First</option><option value="second">Second</option></select>
 <textarea bind:value aria-label="Message"></textarea>
 <button type="button" bind:this={button} class:active={checked} style:opacity={checked ? 1 : 0.8}>Save</button>
 <dialog bind:this={dialog}><p>Example dialog</p></dialog>
 <svelte:element this={heading}>Heading</svelte:element>
 <svg viewBox="0 0 10 10"><path d="M0 0h10v10Z" /></svg>
</form>
<style>button.active { font-weight: bold; } form { display: contents; }</style>
`;

/** Exercise the emitted app, every element definition, and real native binding compilation. */
export async function assertAtomCompiler(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-native-atoms-'));
	try {
		const files = projectFiles({ kind: 'app', name: 'atom-proof' });
		for (const file of files) {
			await mkdir(dirname(join(root, file.path)), { recursive: true });
			await writeFile(join(root, file.path), file.contents);
		}
		for (const file of files.filter(
			(file) => file.path.includes('/atoms/') && file.path.endsWith('.svelte')
		)) {
			const atom = nativeAtoms.find((atom) => file.path.endsWith('/' + atom.name + '.svelte'))!;
			const slug = atom.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
			await measureWorkload(
				`reports.component.shared-primitives-atoms-${slug}`,
				'compile-native-atom',
				() => {
					expect(
						compile(file.contents, { filename: join(root, file.path), dev: false }).js.code.length
					).toBeGreaterThan(0);
				}
			);
		}
		await assertNativeParity(root);
		for (const [name, source] of Object.entries(atomicRuntimeSources)) {
			const maintained = name === 'atomicComponents.js' ? 'atomicPreprocess.js' : name;
			expect(source).toBe(
				await readFile(
					join(import.meta.dirname, '../../../src/templates/development-tooling', maintained),
					'utf8'
				)
			);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

async function assertNativeParity(root: string): Promise<void> {
	const filename = join(root, 'src/components/Proof.svelte');
	const source = atomicMarkup(native, 'src/components/Proof.svelte', 'molecule');
	const result = await atomicComponents().markup!({ content: source, filename });
	expect(result).toBeDefined();
	const options = { filename, dev: false, cssHash: () => 'native-parity' };
	const expected = compile(native, options),
		actual = compile(result!.code, options);
	expect(actual.js.code).toBe(expected.js.code);
	expect(actual.css?.code).toBe(expected.css?.code);
	const path = join(root, 'src/components/atoms/HtmlButton.svelte');
	const original = await readFile(path, 'utf8');
	await writeFile(path, original + '<style>button { color: red; }</style>');
	expect(() => atomicComponents().markup!({ content: source, filename })).toThrow(
		'element contract'
	);
	await writeFile(path, original);
}
