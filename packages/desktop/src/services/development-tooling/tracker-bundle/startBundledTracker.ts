// @harness-uid u_tba2m5pvzc
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { TrackerBundleHost, TrackerBundleOutcome } from './TrackerBundleService.types';
import { installBundledTracker } from './installBundledTracker';

/** Runs programs for real, never through a shell, and reports their exit status. */
export function systemTrackerHost(): TrackerBundleHost {
	return {
		uid: process.getuid?.() ?? 0,
		sleep: (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
		run: (file, args, env) =>
			new Promise((done) => {
				execFile(
					file,
					args,
					{ env: env ? { ...process.env, ...env } : process.env, timeout: 60_000 },
					(error, stdout) => {
						const status = typeof error?.code === 'number' ? error.code : Number(error !== null);
						done({ status, stdout });
					}
				);
			})
	};
}

/**
 * Called once when the packaged Mac app starts. `appPath` is Electron's app path inside the
 * bundle (`Harness.app/Contents/Resources/app`). A development run has no bundled executable
 * and does nothing.
 */
export async function startBundledTracker(
	appPath: string,
	home: string,
	host: TrackerBundleHost = systemTrackerHost()
): Promise<TrackerBundleOutcome> {
	const manifest = JSON.parse(await readFile(join(appPath, 'package.json'), 'utf8'));
	const revision: unknown = manifest.revision;
	if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision))
		return { status: 'not-bundled' };
	return installBundledTracker({ app: resolve(appPath, '../../..'), revision, home, host });
}
