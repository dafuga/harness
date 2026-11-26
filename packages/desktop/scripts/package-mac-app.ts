import { execFileSync } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { macIcon } from './mac-icon/mac-icon';
import { stageTrackerBundle } from './package-mac-tracker';

export const bundleId = 'dev.harness.desktop';
export const migrationBinary = 'Contents/Helpers/HarnessKeychainMigration';

export interface MacAppSources {
	/** The directory holding the built `main.cjs` and `preload.cjs`. */
	bundles: string;
	/** The built renderer. */
	renderer: string;
	revision: string;
}

async function copyProject(output: string, sources: MacAppSources): Promise<void> {
	const project = resolve(output, 'Contents/Resources/app');
	await mkdir(resolve(project, 'dist'), { recursive: true });
	await cp(sources.renderer, resolve(project, 'build'), { recursive: true });
	for (const entry of ['main.cjs', 'preload.cjs'])
		await cp(join(sources.bundles, entry), resolve(project, 'dist', entry));
	const playwright = dirname(
		createRequire(import.meta.url).resolve('playwright-core/package.json')
	);
	await cp(playwright, resolve(project, 'node_modules/playwright-core'), { recursive: true });
	await writeFile(
		resolve(project, 'package.json'),
		JSON.stringify({
			name: 'harness-desktop',
			productName: 'Harness',
			version: '0.1.0',
			revision: sources.revision,
			main: 'dist/main.cjs'
		})
	);
}

function brandPlist(output: string): void {
	const plist = resolve(output, 'Contents/Info.plist');
	for (const command of [
		'Set :CFBundleDisplayName Harness',
		'Set :CFBundleName Harness',
		`Set :CFBundleIdentifier ${bundleId}`
	])
		execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist]);
}

function compileMigrationHelper(helper: string): void {
	execFileSync('/usr/bin/xcrun', [
		'clang',
		'-mmacosx-version-min=13.0',
		'-Wall',
		'-Wextra',
		'-Wno-deprecated-declarations',
		'-framework',
		'Security',
		'-framework',
		'CoreFoundation',
		join(import.meta.dirname, 'mac-safe-storage-migration.c'),
		'-o',
		helper
	]);
}

/** Builds the unsigned Harness.app at `output` from the installed Electron distribution. */
export async function assembleMacApp(output: string, sources: MacAppSources): Promise<void> {
	const { default: electron } = await import('electron');
	const original = resolve(dirname(electron as unknown as string), '../..');
	execFileSync('/usr/bin/ditto', [original, output]);
	await copyProject(output, sources);
	brandPlist(output);
	await macIcon(output);
	const helper = join(output, migrationBinary);
	await mkdir(dirname(helper), { recursive: true });
	compileMigrationHelper(helper);
	await stageTrackerBundle(output);
}
