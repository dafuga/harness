import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { httpReferences } from '../../src/services/development-tooling/source-index-service/httpReferences';
import { scanImports } from '../../src/services/development-tooling/source-index-service/scanImports';
import { svelteScripts } from '../../src/services/development-tooling/source-index-service/svelteScripts';
import type { SourceReference } from '../../src/utils/development-tooling/scanImports.types';

function summarise(references: SourceReference[]) {
	return references.map(({ specifier, via, typeOnly, detail }) => ({
		specifier,
		via,
		typeOnly,
		...(detail === undefined ? {} : { detail })
	}));
}

const tsCode = [
	"import type { User } from './models/user';",
	"export * from './barrel';",
	'const loaded = await import(modulePath);',
	"const fs = require('fs');",
	"fetch('/api/users');"
].join('\n');

const svelteCode = [
	"<script>import './setup';</script>",
	'<p>Hello</p>',
	'<script context="module">export * from \'./types\';</script>'
].join('\n');

const httpCode = [
	"fetch('/api/users');",
	'window.fetch(`/api/${userId}`);',
	'fetch(url);',
	"other.fetch('/x');"
].join('\n');

test('Typescript scan lists imports, reexports and calls in order', () => {
	const references = summarise(scanImports(tsCode, 'ts'));
	expect(references).toEqual([
		{ specifier: './models/user', via: 'import', typeOnly: true },
		{ specifier: './barrel', via: 'reexport', typeOnly: false },
		{
			specifier: null,
			via: 'dynamic-import',
			typeOnly: false,
			detail: 'import(modulePath)'
		},
		{ specifier: 'fs', via: 'require', typeOnly: false },
		{ specifier: '/api/users', via: 'http', typeOnly: false }
	]);
	recordExampleCases(
		{
			unitId: 'function.scan-imports',
			symbol: 'scanImports',
			state: 'typescript-scan-lists-imports-reexports-and-calls-in-order',
			evidence: 'examples-cases',
			file: 'typescript-scan-lists-imports-reexports-and-calls-in-order.json'
		},
		[
			{
				name: 'module with type import, reexport, unresolved import(), require and fetch',
				input: { code: tsCode, language: 'ts' },
				output: references
			}
		]
	);
});

test('Svelte scan returns references from each script block', () => {
	const references = summarise(scanImports(svelteCode, 'svelte'));
	expect(references).toEqual([
		{ specifier: './setup', via: 'import', typeOnly: false },
		{ specifier: './types', via: 'reexport', typeOnly: false }
	]);
	recordExampleCases(
		{
			unitId: 'function.scan-imports',
			symbol: 'scanImports',
			state: 'svelte-scan-returns-references-from-each-script-block',
			evidence: 'examples-cases',
			file: 'svelte-scan-returns-references-from-each-script-block.json'
		},
		[
			{
				name: 'default and module script blocks with a markup line between them',
				input: { code: svelteCode, language: 'svelte' },
				output: references
			}
		]
	);
});

test('Svelte script bodies are captured in source order', () => {
	const bodies = svelteScripts(
		"<script>import './setup';</script>\n<p>hi</p>\n<script context=\"module\">export const ready = true;</script>"
	);
	expect(bodies).toEqual(["import './setup';", 'export const ready = true;']);
	recordExampleCases(
		{
			unitId: 'function.scan-imports',
			symbol: 'svelteScripts',
			state: 'svelte-script-bodies-are-captured-in-source-order',
			evidence: 'examples-cases',
			file: 'svelte-script-bodies-are-captured-in-source-order.json'
		},
		[
			{
				name: 'two script tags with markup between them',
				input: {
					code: "<script>import './setup';</script>\n<p>hi</p>\n<script context=\"module\">export const ready = true;</script>"
				},
				output: bodies
			}
		]
	);
});

test('Stylesheet imports are listed and other files return none', () => {
	const styleCode = "@import url('./theme.css');\n@import \"./base.css\";";
	const styles = summarise(scanImports(styleCode, 'css'));
	const other = scanImports('<div></div>', 'other');
	expect(styles).toEqual([
		{ specifier: './theme.css', via: 'style-import', typeOnly: false },
		{ specifier: './base.css', via: 'style-import', typeOnly: false }
	]);
	expect(other).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.scan-imports',
			symbol: 'scanImports',
			state: 'stylesheet-imports-are-listed-and-other-files-return-none',
			evidence: 'examples-cases',
			file: 'stylesheet-imports-are-listed-and-other-files-return-none.json'
		},
		[
			{
				name: 'css with url() and quoted @import lines',
				input: { code: styleCode, language: 'css' },
				output: styles
			},
			{
				name: 'markup in an other language',
				input: { code: '<div></div>', language: 'other' },
				output: other
			}
		]
	);
});

test('Fetch calls record literal, template and unresolved paths', () => {
	const found = summarise(httpReferences(httpCode));
	expect(found).toEqual([
		{ specifier: '/api/users', via: 'http', typeOnly: false },
		{ specifier: '/api/${}', via: 'http', typeOnly: false },
		{ specifier: null, via: 'http', typeOnly: false, detail: 'fetch(url)' }
	]);
	recordExampleCases(
		{
			unitId: 'function.scan-imports',
			symbol: 'httpReferences',
			state: 'fetch-calls-record-literal-template-and-unresolved-paths',
			evidence: 'examples-cases',
			file: 'fetch-calls-record-literal-template-and-unresolved-paths.json'
		},
		[
			{
				name: 'literal, template, unresolved fetch and an ignored object method',
				input: { code: httpCode },
				output: found
			}
		]
	);
});
