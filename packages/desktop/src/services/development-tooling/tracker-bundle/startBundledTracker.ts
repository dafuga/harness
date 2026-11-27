// @harness-uid u_tba2m5pvzc
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { TrackerBundleHost, TrackerBundleOutcome } from './TrackerBundleService.types';
import { trackerBundleLayout } from './trackerBundleLayout';
import { TrackerBundleError } from './TrackerBundleError';
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

/** Keep the install result available after Finder closes the app's console. */
async function logInstall(
	home: string,
	revision: string | null,
	result: TrackerBundleOutcome | { status: 'failed'; reason: string }
): Promise<void> {
	const { logs } = trackerBundleLayout(home);
	try {
		await mkdir(logs, { recursive: true, mode: 0o700 });
		const line = JSON.stringify({ time: new Date().toISOString(), revision, ...result });
		await appendFile(join(logs, 'tracker-install.log'), line + '\n', { mode: 0o600 });
	} catch (error) {
		console.error('Could not write the Tracker install log.', error);
	}
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
	let revision: string | null = null;
	try {
		const manifest = JSON.parse(await readFile(join(appPath, 'package.json'), 'utf8'));
		if (typeof manifest.revision !== 'string' || !/^[0-9a-f]{40}$/.test(manifest.revision))
			return { status: 'not-bundled' };
		const build: string = manifest.revision;
		revision = build;
		const outcome = await installBundledTracker({
			app: resolve(appPath, '../../..'),
			revision: build,
			home,
			host
		});
		await logInstall(home, revision, outcome);
		return outcome;
	} catch (error) {
		const reason =
			error instanceof TrackerBundleError
				? error.message
				: error instanceof Error
					? error.name
					: 'Unknown install error';
		await logInstall(home, revision, { status: 'failed', reason });
		throw error;
	}
}
