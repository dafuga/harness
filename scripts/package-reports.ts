import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
const destination = 'dist/reports';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['build', 'dist', 'scripts']) {
	await cp(`packages/reports/${name}`, `${destination}/${name}`, { recursive: true });
}
const result = await Bun.build({
	entrypoints: ['packages/reports/src/cli/index.ts'],
	target: 'bun',
	outdir: destination,
	naming: 'cli.js'
});

if (!result.success) throw new Error('Report CLI bundle failed.');

// The compiled console and report viewer as text, and the exporter built on them, for hosts that
// serve the console from their own server after their own policy has admitted the request. This
// is server-side data: no route exposes it by itself.
const text = (path: string) => readFile(`packages/reports/dist/${path}`, 'utf8');
const [script, style, viewer, viewerStyle] = await Promise.all(
	[
		'console/console.iife.js',
		'console/console.css',
		'viewer/report.iife.js',
		'viewer/report.css'
	].map(text)
);
const exporter = await Bun.build({
	entrypoints: ['packages/reports/src/utils/consoleExport.ts'],
	target: 'browser',
	format: 'esm',
	outdir: 'dist/api',
	naming: 'console-export.js'
});
if (!exporter.success)
	throw new Error(`Console export bundle failed.\n${exporter.logs.join('\n')}`);
await writeFile(
	'dist/api/console-ui.js',
	[
		"import { consoleExport } from './console-export.js';",
		`export const consoleAssets = ${JSON.stringify({ script, style })};`,
		`export const portableAssets = ${JSON.stringify({ script: viewer, style: viewerStyle })};`,
		'export const consoleExporter = (input) => consoleExport(input, portableAssets);',
		''
	].join('\n')
);
await writeFile(
	'dist/types/lib/console-ui.d.ts',
	[
		"import type { ConsoleAssets, ConsoleExporter } from './console';",
		'export declare const consoleAssets: ConsoleAssets;',
		'export declare const portableAssets: ConsoleAssets;',
		'export declare const consoleExporter: ConsoleExporter;',
		''
	].join('\n')
);
