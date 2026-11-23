// @harness-uid u_m3rqfrppy7
import { lstatSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { macIcon } from './mac-icon/mac-icon';
import { MacPackageError } from './package-mac.types';
const bundleId = 'dev.harness.desktop';
const teamId = 'PAC8VHDW3G';
const codesign = '/usr/bin/codesign';
const requirement = `identifier "${bundleId}" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = ${teamId}`;

function releaseSigner() {
	const identity = process.env.HARNESS_MAC_SIGN_IDENTITY;
	if (!identity || !/^[a-f0-9]{40}$/i.test(identity))
		throw new MacPackageError(
			'HARNESS_MAC_SIGN_IDENTITY must be the exact Developer ID Application certificate SHA-1 fingerprint.'
		);
	const keychain = join(homedir(), 'Library/Keychains/harness-signing.keychain-db');
	if (!lstatSync(keychain, { throwIfNoEntry: false })?.isFile())
		throw new MacPackageError('Set up the dedicated harness-signing.keychain-db before packaging.');
	const available = execFileSync(
		'/usr/bin/security',
		['find-identity', '-v', '-p', 'codesigning', keychain],
		{ encoding: 'utf8' }
	);
	const signers = available.matchAll(
		/^\s*\d+\)\s+([a-f0-9]{40})\s+"Developer ID Application: [^"\r\n]+ \(([A-Z0-9]{10})\)"/gim
	);
	if (
		![...signers].some(
			([, hash, team]) => hash.toUpperCase() === identity.toUpperCase() && team === teamId
		)
	)
		throw new MacPackageError(
			`HARNESS_MAC_SIGN_IDENTITY must select a Developer ID Application identity for ${teamId} in the Harness build keychain.`
		);
	return { identity, keychain };
}

function verifyRelease(app: string): void {
	const designated = execFileSync(codesign, ['-d', '-r-', app], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	})
		.trim()
		.replaceAll(' /* exists */', '');
	if (designated !== `designated => ${requirement}`)
		throw new MacPackageError(
			`Artifact does not have the Harness Developer ID release requirement (${teamId}).`
		);
	execFileSync(codesign, ['--verify', '--deep', '--strict', '-R', `=${requirement}`, app], {
		stdio: 'inherit'
	});
}

async function populateApp(output: string): Promise<void> {
	const { default: electron } = await import('electron');
	const original = resolve(dirname(electron as unknown as string), '../..');
	execFileSync('/usr/bin/ditto', [original, output]);
	const project = resolve(output, 'Contents/Resources/app');
	await mkdir(resolve(project, 'dist'), { recursive: true });
	await cp('build', resolve(project, 'build'), { recursive: true });
	await cp('dist/main.cjs', resolve(project, 'dist/main.cjs'));
	await cp('dist/preload.cjs', resolve(project, 'dist/preload.cjs'));
	const playwright = dirname(
		createRequire(import.meta.url).resolve('playwright-core/package.json')
	);
	await cp(playwright, resolve(project, 'node_modules/playwright-core'), { recursive: true });
	await writeFile(
		resolve(project, 'package.json'),
		JSON.stringify({ name: 'harness-desktop', version: '0.1.0', main: 'dist/main.cjs' })
	);
	const plist = resolve(output, 'Contents/Info.plist');
	execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleDisplayName Harness', plist]);
	execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleName Harness', plist]);
	execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleIdentifier ${bundleId}`, plist]);
	await macIcon(output);
}

async function packageRelease(): Promise<void> {
	const { identity, keychain } = releaseSigner();
	const directory = resolve('dist/mac');
	const output = join(directory, 'Harness.app');
	await mkdir(directory, { recursive: true });
	const staging = await mkdtemp(join(directory, '.package-'));
	const candidate = join(staging, 'Harness.app');
	try {
		await populateApp(candidate);
		execFileSync(
			codesign,
			['--force', '--deep', '--sign', identity, '--keychain', keychain, candidate],
			{
				stdio: 'inherit'
			}
		);
		verifyRelease(candidate);
		await rm(output, { recursive: true, force: true });
		await rename(candidate, output);
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
	console.log(output);
}

if (process.platform !== 'darwin') throw new MacPackageError('This package target requires macOS.');
const [mode, artifact, ...extra] = process.argv.slice(2);
if (mode === '--verify' && artifact && extra.length === 0) {
	verifyRelease(resolve(artifact));
} else if (mode === undefined) {
	await packageRelease();
} else {
	throw new MacPackageError('Usage: bun run package:mac [--verify path/to/Harness.app]');
}
