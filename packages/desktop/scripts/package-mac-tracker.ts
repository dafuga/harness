// @harness-uid u_tbb3n6qwad
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, lstatSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { MacPackageError } from './package-mac.types';

/** The Tracker the app carries: the compiled Harness CLI and the `tracker` shim that calls it. */
export const trackerHelper = 'Contents/Helpers/harness';
export const trackerShim = 'Contents/Resources/tracker-shim.sh';
export const trackerEntitlements = join(import.meta.dirname, 'mac-tracker-entitlements.plist');

/** Compiles the CLI that serves Tracker into the app, with the shim beside it. */
export async function stageTrackerBundle(output: string): Promise<void> {
	const root = resolve(import.meta.dirname, '../../..');
	const helper = join(output, trackerHelper);
	await mkdir(dirname(helper), { recursive: true });
	execFileSync(
		process.versions.bun ? process.execPath : 'bun',
		['build', '--compile', join(root, 'src/cli/index.ts'), '--outfile', helper],
		{ cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }
	);
	const shim = join(output, trackerShim);
	await mkdir(dirname(shim), { recursive: true });
	copyFileSync(join(root, 'scripts/tracker-shim.sh'), shim);
	chmodSync(shim, 0o755);
}

/**
 * Signing options for the Tracker executable: the app's identifier, as the Keychain helper has,
 * so the release requirement holds for every nested executable, and the entitlements Bun needs.
 */
export function trackerSigning(app: string, file: string, identifier: string) {
	return file === join(app, trackerHelper)
		? {
				entitlements: trackerEntitlements,
				additionalArguments: ['--identifier', identifier]
			}
		: undefined;
}

/** Refuses a release whose Tracker is missing, unsigned for release, or does not start. */
export function verifyTrackerBundle(app: string, verifyIdentity: (file: string) => void): void {
	const helper = join(app, trackerHelper);
	const shim = lstatSync(join(app, trackerShim), { throwIfNoEntry: false });
	if (!lstatSync(helper, { throwIfNoEntry: false })?.isFile() || !shim?.isFile())
		throw new MacPackageError('Artifact must carry the bundled Tracker and its shim.');
	if ((shim.mode & 0o111) === 0)
		throw new MacPackageError('The bundled Tracker shim must be executable.');
	verifyIdentity(helper);
	const version = execFileSync(helper, ['--version'], { encoding: 'utf8', timeout: 30_000 });
	if (!/^\d+\.\d+\.\d+/.test(version))
		throw new MacPackageError('The bundled Tracker executable did not report a version.');
}
