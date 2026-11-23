import type { ExampleCase } from './template.development-tooling-atomic-markup.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	atomicProjectFiles,
	atomicMarkup
} from '../../src/templates/development-tooling/atomicMarkup';

const UNIT_ID = 'template.development-tooling-atomic-markup';

function record(state: string, symbol: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{ unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

const PAGE_SOURCE = '<main>\n\t<button>Save</button>\n</main>\n';
const PAGE_OUTPUT =
	'<!-- @harness-tier page -->\n<!-- @harness-atoms ../components/atoms -->\n<hx-main>\n\t<hx-button>Save</hx-button>\n</hx-main>\n';

test('Generates native atom tags for a page', () => {
	const output = atomicMarkup(PAGE_SOURCE, 'src/routes/+page.svelte', 'page');

	expect(output).toBe(PAGE_OUTPUT);
	record('generates-native-atom-tags-for-a-page', 'atomicMarkup', [
		{
			name: 'page with a main and a button',
			input: { source: PAGE_SOURCE, path: 'src/routes/+page.svelte', level: 'page' },
			output
		}
	]);
});

test('Computes the atoms directory from the file path', () => {
	const source = '<h1>Reports</h1>\n<Chart data={rows} />\n';
	const output = atomicMarkup(source, 'src/routes/reports/+page.svelte', 'page');

	expect(output).toBe(
		'<!-- @harness-tier page -->\n<!-- @harness-atoms ../../components/atoms -->\n<hx-h1>Reports</hx-h1>\n<Chart data={rows} />\n'
	);
	record('computes-the-atoms-directory-from-the-file-path', 'atomicMarkup', [
		{
			name: 'nested route resolves the atoms directory two levels up',
			input: { source, path: 'src/routes/reports/+page.svelte', level: 'page' },
			output
		}
	]);
});

test('Keeps attributes, expressions and bindings as written', () => {
	const source = '<a href={url} class:active={on}>Open</a>\n';
	const output = atomicMarkup(source, 'src/routes/+page.svelte', 'page');

	expect(output).toContain('<hx-a href={url} class:active={on}>Open</hx-a>\n');
	record('keeps-attributes-expressions-and-bindings-as-written', 'atomicMarkup', [
		{
			name: 'link with an expression attribute and a class directive',
			input: { source, path: 'src/routes/+page.svelte', level: 'page' },
			output
		}
	]);
});

test('Rewrites only eligible svelte files in a project', () => {
	const files = [
		{ path: 'src/routes/+page.svelte', contents: PAGE_SOURCE },
		{ path: 'src/lib/format.ts', contents: "export const label = 'Save';\n" },
		{ path: 'src/components/atoms/Card.svelte', contents: '<div>Card</div>\n' }
	];
	const result = atomicProjectFiles(files);

	expect(result).toEqual([
		{ path: 'src/routes/+page.svelte', contents: PAGE_OUTPUT },
		{ path: 'src/lib/format.ts', contents: "export const label = 'Save';\n" },
		{ path: 'src/components/atoms/Card.svelte', contents: '<div>Card</div>\n' }
	]);
	expect(files[0]?.contents).toBe(PAGE_SOURCE);
	record('rewrites-only-eligible-svelte-files-in-a-project', 'atomicProjectFiles', [
		{
			name: 'page rewritten, ts file and atoms component copied unchanged',
			input: { files },
			output: result
		}
	]);
});

test('Tags layout files with the layout tier', () => {
	const files = [
		{
			path: 'src/routes/+layout.svelte',
			contents: '<nav>\n\t<a href="/">Home</a>\n</nav>\n{@render children()}\n'
		}
	];
	const result = atomicProjectFiles(files);

	expect(result[0]?.contents).toBe(
		'<!-- @harness-tier layout -->\n<!-- @harness-atoms ../components/atoms -->\n<hx-nav>\n\t<hx-a href="/">Home</hx-a>\n</hx-nav>\n{@render children()}\n'
	);
	record('tags-layout-files-with-the-layout-tier', 'atomicProjectFiles', [
		{
			name: 'layout file gets the layout tier and keeps the render block',
			input: { files },
			output: result
		}
	]);
});

test('Throws when the markup cannot be parsed', () => {
	const source = '<main>\n\t<button>Save</button>\n';
	let error: unknown;
	try {
		atomicMarkup(source, 'src/routes/+page.svelte', 'page');
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	record('throws-when-the-markup-cannot-be-parsed', 'atomicMarkup', [
		{
			name: 'unclosed main element propagates the svelte parse error',
			input: { source, path: 'src/routes/+page.svelte', level: 'page' },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});
