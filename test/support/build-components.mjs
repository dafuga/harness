
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { compile } from 'svelte/compiler';
import { build } from 'esbuild';
const out = '.cache/harness/title-components';
mkdirSync(out, { recursive: true });
const entries = { TitleList: './src/components/TitleList.svelte', TitleRow: './src/components/TitleRow.svelte' };
if (existsSync('src/components/TitleFrame.svelte')) entries.TitleFramePreview = './test/support/TitleFramePreview.svelte';
const entry = Object.entries(entries).map(([name, path]) => 'export { default as ' + name + ' } from ' + JSON.stringify(path) + ';').join('\n');
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'js' }, bundle: true, external: ['svelte', 'svelte/*'], platform: 'node', format: 'esm', outfile: out + '/components.mjs',
 plugins: [{ name: 'fixture-components', setup(builder) {
  builder.onLoad({ filter: /\.svelte$/ }, ({ path }) => ({ contents: compile(readFileSync(path, 'utf8'), { filename: path, generate: 'server' }).js.code, resolveDir: dirname(path), loader: 'js' }));
 } }] });
writeFileSync(out + '/sources.json', JSON.stringify(entries));
