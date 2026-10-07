import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
const destination = 'dist/reports';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['build', 'dist', 'scripts']) {
	await cp(`packages/reports/${name}`, `${destination}/${name}`, { recursive: true });
}
const identity = await readFile('packages/reports/build/client/_app/version.json', 'utf8');
await writeFile(`${destination}/build/.harness-build-id`, identity);
const result = await Bun.build({
	entrypoints: ['packages/reports/src/cli/index.ts'],
	target: 'bun',
	outdir: destination,
	naming: 'cli.js'
});

if (!result.success) throw new Error('Report CLI bundle failed.');
