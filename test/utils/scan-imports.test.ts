import { expect, test } from 'vitest';
import { scanImports } from '../../src/services/source-index-service/scanImports';

test('scanImports records HTTP requests without reading URL-looking text as calls', () => {
	const code = [
		"// fetch('/api/comment');",
		'const text = "fetch(\'/api/text\')";',
		"await fetch('/api/orders?limit=10');",
		'await event.fetch(`/api/orders/${id}`);',
		"await fetch('https://elsewhere.example/api/orders');",
		'await fetch(address);'
	].join('\n');
	expect(scanImports(code, 'ts')).toEqual([
		{ via: 'http', specifier: '/api/orders?limit=10', typeOnly: false },
		{ via: 'http', specifier: '/api/orders/${}', typeOnly: false },
		{ via: 'http', specifier: 'https://elsewhere.example/api/orders', typeOnly: false },
		{ via: 'http', specifier: null, typeOnly: false, detail: 'fetch(address)' }
	]);
	expect(
		scanImports('<script>fetch("/api/orders")</script><p>fetch("/api/text")</p>', 'svelte')
	).toEqual([{ via: 'http', specifier: '/api/orders', typeOnly: false }]);
});

test('scanImports reads static, type, side-effect, re-export, dynamic, require and URL references', () => {
	const code = [
		"import defaultValue, { a,\n\tb } from './multi';",
		"import type { T } from './types';",
		"import './side-effect.css';",
		"export * from './all';",
		"export { c as d } from './named';",
		"const lazy = () => import('./lazy');",
		"const legacy = require('./legacy');",
		"const asset = new URL('./asset.wasm', import.meta.url);",
		"import * as ns from 'node:path';"
	].join('\n');

	expect(scanImports(code, 'ts')).toEqual([
		{ specifier: './multi', via: 'import', typeOnly: false },
		{ specifier: './types', via: 'import', typeOnly: true },
		{ specifier: './side-effect.css', via: 'import', typeOnly: false },
		{ specifier: './all', via: 'reexport', typeOnly: false },
		{ specifier: './named', via: 'reexport', typeOnly: false },
		{ specifier: './lazy', via: 'dynamic-import', typeOnly: false },
		{ specifier: './legacy', via: 'require', typeOnly: false },
		{ specifier: './asset.wasm', via: 'url', typeOnly: false },
		{ specifier: 'node:path', via: 'import', typeOnly: false }
	]);
});

test('scanImports ignores comments, strings, templates and regular expressions', () => {
	const code = [
		"// import { a } from './comment';",
		"/* export * from './block'; */",
		'const text = "import { b } from \'./string\'";',
		"const template = `import { c } from './template' ${'x'} and import('./inner')`;",
		"const pattern = /import\\('.\\/regex'\\)/;",
		"const url = 'https://example.test//path';",
		"import { real } from './real';"
	].join('\n');

	expect(scanImports(code, 'ts')).toEqual([
		{ specifier: './real', via: 'import', typeOnly: false }
	]);
});

test('scanImports reports non-literal dynamic references as uncertain', () => {
	const references = scanImports('const load = (name: string) => import(`./x/${name}`);', 'ts');
	expect(references).toEqual([
		{ specifier: null, via: 'dynamic-import', typeOnly: false, detail: 'import(`./x/${name}`)' }
	]);
});

test('scanImports reads Svelte script blocks and stylesheet imports', () => {
	const svelte = [
		'<script lang="ts" module>',
		"\timport { shared } from './shared';",
		'</script>',
		'<script lang="ts">',
		"\timport Card from './Card.svelte';",
		'</script>',
		"<p>import nothing from './markup'</p>"
	].join('\n');
	expect(scanImports(svelte, 'svelte').map((item) => item.specifier)).toEqual([
		'./shared',
		'./Card.svelte'
	]);
	expect(
		scanImports(
			'<!-- @harness-atoms ./atoms -->\n<hx-button>Save</hx-button><hx-button>Again</hx-button><!-- <hx-input /> -->{"<hx-select>"}',
			'svelte'
		)
	).toEqual([{ specifier: './atoms/HtmlButton.svelte', via: 'import', typeOnly: false }]);
	expect(scanImports("@import './base.css';\n@import url('theme.css');", 'css')).toEqual([
		{ specifier: './base.css', via: 'style-import', typeOnly: false },
		{ specifier: 'theme.css', via: 'style-import', typeOnly: false }
	]);
});

test('scanImports does not mistake methods named import or require for module calls', () => {
	const code = [
		'export class Loader {',
		'\tasync import(flags: Record<string, string>): Promise<void> {',
		'\t\tawait this.import(flags);',
		'\t\tthis.require(flags);',
		'\t}',
		'\trequire(value: unknown): unknown {',
		"\t\treturn import('./real');",
		'\t}',
		'}'
	].join('\n');
	expect(scanImports(code, 'ts')).toEqual([
		{ specifier: './real', via: 'dynamic-import', typeOnly: false }
	]);
});

test('scanImports follows executable template substitutions and namespaced or type-only re-exports', () => {
	const code = [
		"const loaded = `${await import('./inside-template')}`;",
		"export * as helpers from './namespace';",
		"export type { Shape } from './shapes';"
	].join('\n');
	expect(scanImports(code, 'ts')).toEqual([
		{ specifier: './inside-template', via: 'dynamic-import', typeOnly: false },
		{ specifier: './namespace', via: 'reexport', typeOnly: false },
		{ specifier: './shapes', via: 'reexport', typeOnly: true }
	]);
});

test('scanImports reports concatenated and commented dynamic arguments as uncertain', () => {
	const code = [
		"const a = import('./plugins/' + name);",
		"const b = import(/* lazy */ './chunk');"
	].join('\n');
	expect(scanImports(code, 'ts')).toEqual([
		{
			specifier: null,
			via: 'dynamic-import',
			typeOnly: false,
			detail: "import('./plugins/' + name)"
		},
		{
			specifier: null,
			via: 'dynamic-import',
			typeOnly: false,
			detail: "import(/* lazy */ './chunk')"
		}
	]);
});
