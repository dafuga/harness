import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	atomicComponentFiles,
	atomicTypeFiles
} from '../../src/templates/development-tooling/atomicComponents';

function describeFiles(files: Array<{ path: string; contents: string }>) {
	return files.map(({ path, contents }) => ({
		path,
		lines: contents
			.split('\n')
			.filter((line) => /@harness-tier|@harness-element|interface SvelteHTMLElements|interface HTMLElementTagNameMap|'hx-a'/.test(line))
	}));
}

test('Emits native atom components and runtime scripts', () => {
	const files = atomicComponentFiles();
	const paths = files.map(({ path }) => path);
	expect(paths).toContain('src/components/atoms/HtmlA.svelte');
	expect(paths.some((path) => path.startsWith('scripts/'))).toBe(true);
	const output = describeFiles(files);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-components',
			symbol: 'atomicComponentFiles',
			state: 'emits-native-atom-components-and-runtime-scripts',
			evidence: 'examples-cases',
			file: 'emits-native-atom-components-and-runtime-scripts.json'
		},
		[{ name: 'all atom and runtime scaffold paths with declaration markers', input: {}, output }]
	);
});

test('Adds native atom tags to TypeScript declarations', () => {
	const files = atomicTypeFiles();
	expect(files).toHaveLength(2);
	expect(files[0].contents).toContain("'hx-a': NativeElements['a'];");
	expect(files[1].contents).toContain("'hx-a': HTMLElementTagNameMap['a'];");
	const output = files.map(({ path, contents }) => ({
		path,
		lines: contents.split('\n').filter((line) => /interface |'hx-a'/.test(line))
	}));
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-components',
			symbol: 'atomicTypeFiles',
			state: 'adds-native-atom-tags-to-typescript-declarations',
			evidence: 'examples-cases',
			file: 'adds-native-atom-tags-to-typescript-declarations.json'
		},
		[{ name: 'Svelte and DOM declarations include the anchor atom', input: {}, output }]
	);
});
