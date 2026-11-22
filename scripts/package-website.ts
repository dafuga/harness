// @harness-uid u_uss455qboj
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { ReportCliBundleError } from './package-website.types';
const destination = 'dist/reports';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['build', 'dist']) {
	await cp(`packages/reports/${name}`, `${destination}/${name}`, { recursive: true });
}
const result = await Bun.build({
	entrypoints: ['packages/reports/src/cli/index.ts'],
	target: 'bun',
	outdir: destination,
	naming: 'cli.js'
});

if (!result.success) throw new ReportCliBundleError('Report CLI bundle failed.');

// The compiled console as text, for hosts that serve it from their own server after their own
// policy has admitted the request. This is server-side data: no route exposes it by itself.
const text = (path: string) => readFile(`packages/reports/dist/${path}`, 'utf8');
const [script, style] = await Promise.all(
	['console/console.iife.js', 'console/console.css'].map(text)
);
await writeFile(
	'dist/api/console-ui.js',
	`export const consoleAssets = ${JSON.stringify({ script, style })};\n`
);
await writeFile(
	'dist/types/lib/console-ui.d.ts',
	[
		"import type { ConsoleAssets } from './console';",
		'export declare const consoleAssets: ConsoleAssets;',
		''
	].join('\n')
);
