/** Run with Bun: builds the probe main process into the directory given as the one argument. */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outdir = process.argv[2];
const result = await Bun.build({
	entrypoints: [resolve(import.meta.dir, 'package-mac-app-probe.ts')],
	target: 'node',
	format: 'cjs',
	external: ['electron'],
	naming: 'main.cjs',
	outdir,
	plugins: [
		{
			name: 'record-tracker-start',
			setup(build) {
				build.onLoad({ filter: /[/\\]startBundledTracker\.ts$/ }, () => ({
					loader: 'ts',
					contents: `export async function startBundledTracker(appPath: string) {
						(globalThis as { trackerStartedFrom?: string }).trackerStartedFrom = appPath;
						return { status: 'not-bundled' };
					}`
				}));
			}
		}
	]
});
if (!result.success) throw new AggregateError(result.logs, 'The probe did not build.');
writeFileSync(join(outdir, 'preload.cjs'), '');
