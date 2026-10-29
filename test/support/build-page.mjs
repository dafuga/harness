
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { compile } from 'svelte/compiler';
import { build } from 'esbuild';
const out = '.cache/harness/titles-page';
mkdirSync(out, { recursive: true });
const source = 'src/routes/titles/+page.svelte';
const compiled = compile(readFileSync(source, 'utf8'), { filename: source, generate: 'server' });
await build({ stdin: { contents: compiled.js.code, resolveDir: process.cwd() + '/src/routes/titles', sourcefile: source, loader: 'js' }, bundle: true, external: ['svelte', 'svelte/*'], platform: 'node', format: 'esm', outfile: out + '/page.mjs',
 plugins: [{ name: 'fixture-svelte', setup(builder) {
  builder.onLoad({ filter: /\.svelte$/ }, ({ path }) => ({ contents: compile(readFileSync(path, 'utf8'), { filename: path, generate: 'server' }).js.code, resolveDir: dirname(path), loader: 'js' }));
 } }] });
writeFileSync(out + '/source.txt', readFileSync(source));
