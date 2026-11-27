// @harness-uid u_gxxwi43nxg
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync } from 'node:fs';
import { cp, mkdir, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { macIcon } from './mac-icon/mac-icon';
import { MacPackageError } from './package-mac.types';
import type { MacAppSources } from './package-mac-app.types';
import { stageTrackerBundle } from './package-mac-tracker';

export const bundleId = 'dev.harness.desktop';
/** Electron reports `isPackaged=false` for an executable named `electron`, so it is renamed. */
const executableName = 'Harness';
export const migrationBinary = 'Contents/Helpers/HarnessKeychainMigration';
export const deviceApprovalBinary = 'Contents/Helpers/HarnessDeviceApproval';

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

async function brandApp(output: string): Promise<void> {
	const executables = resolve(output, 'Contents/MacOS');
	await rename(join(executables, 'Electron'), join(executables, executableName));
	const plist = resolve(output, 'Contents/Info.plist');
	for (const command of [
		'Set :CFBundleDisplayName Harness',
		'Set :CFBundleName Harness',
		`Set :CFBundleIdentifier ${bundleId}`,
		`Set :CFBundleExecutable ${executableName}`
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

/** Reuses the native account and sealed-key code. UIKit and the phone computer bridge stay in iOS. */
function compileDeviceApproval(helper: string): void {
	const app = resolve(import.meta.dirname, '../ios/App/App');
	const swift = (folder: string) =>
		readdirSync(join(app, folder))
			.filter(
				(file) =>
					file.endsWith('.swift') &&
					!['HarnessAccountPlugin.swift', 'HubAccountComputers.swift'].includes(file)
			)
			.sort()
			.map((file) => join(app, folder, file));
	const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
	execFileSync('/usr/bin/xcrun', [
		'swiftc',
		'-O',
		'-target',
		`${arch}-apple-macosx13.0`,
		join(import.meta.dirname, 'mac-device-approval.swift'),
		join(app, 'Remote/RemoteCoding.swift'),
		...swift('Account'),
		...swift('Sealed'),
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
	await brandApp(output);
	await macIcon(output);
	const helper = join(output, migrationBinary);
	await mkdir(dirname(helper), { recursive: true });
	compileMigrationHelper(helper);
	compileDeviceApproval(join(output, deviceApprovalBinary));
	await stageTrackerBundle(output);
	restrictBundleModes(output);
}

/** Removes group and other write access from the whole bundle. Links are not followed. */
export function restrictBundleModes(app: string): void {
	execFileSync('/bin/chmod', ['-R', 'go-w', app]);
}

/** Refuses a bundle that Electron would run as unpackaged, or that other users may change. */
export function verifyMacAppLayout(app: string): void {
	const plist = join(app, 'Contents/Info.plist');
	const executable = execFileSync(
		'/usr/libexec/PlistBuddy',
		['-c', 'Print :CFBundleExecutable', plist],
		{ encoding: 'utf8' }
	).trim();
	if (executable !== executableName)
		throw new MacPackageError(`Artifact's executable must be named ${executableName}.`);
	if (!lstatSync(join(app, 'Contents/MacOS', executable), { throwIfNoEntry: false })?.isFile())
		throw new MacPackageError(`Artifact is missing its ${executableName} executable.`);
	const writable = execFileSync('/usr/bin/find', [app, '!', '-type', 'l', '-perm', '+022'], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	});
	if (writable)
		throw new MacPackageError(
			`Artifact must not be writable by group or others: ${writable.split('\n')[0]}`
		);
}
