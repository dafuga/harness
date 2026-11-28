// @harness-uid u_m3rqfrppy7
import { lstatSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildDesktopMain, releaseDefine } from './build-main';
import {
	assembleMacApp,
	bundleId,
	migrationBinary,
	deviceApprovalBinary,
	restrictBundleModes,
	verifyMacAppLayout
} from './package-mac-app';
import { MacPackageError } from './package-mac.types';
import { isRevision, releaseRevision } from './release-revision';
import { trackerSigning, verifyTrackerBundle } from './package-mac-tracker';
const teamId = 'PAC8VHDW3G';
const codesign = '/usr/bin/codesign';
const requirement = `identifier "${bundleId}" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = ${teamId}`;

function releaseSigner() {
	const identity = process.env.HARNESS_MAC_SIGN_IDENTITY;
	if (!identity || !/^[a-f0-9]{40}$/i.test(identity))
		throw new MacPackageError(
			'HARNESS_MAC_SIGN_IDENTITY must be the exact Developer ID Application certificate SHA-1 fingerprint.'
		);
	const dedicated = join(homedir(), 'Library/Keychains/harness-signing.keychain-db');
	const keychain = resolve(process.env.HARNESS_MAC_SIGN_KEYCHAIN ?? dedicated);
	if (!lstatSync(keychain, { throwIfNoEntry: false })?.isFile())
		throw new MacPackageError(
			'Set up harness-signing.keychain-db or select an approved build keychain.'
		);
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

function verifyIdentity(binary: string): void {
	const designated = execFileSync(codesign, ['-d', '-r-', binary], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	})
		.trim()
		.replaceAll(' /* exists */', '');
	if (designated !== `designated => ${requirement}`)
		throw new MacPackageError(
			`Artifact does not have the Harness Developer ID release requirement (${teamId}).`
		);
	const signature = spawnSync(codesign, ['-d', '-vvvv', binary], {
		encoding: 'utf8'
	});
	if (
		signature.status !== 0 ||
		!/^CodeDirectory .*flags=0x[0-9a-f]+\([^\n]*\bruntime\b/m.test(signature.stderr)
	)
		throw new MacPackageError('Artifact must use hardened runtime.');
}

function verifyRelease(app: string): void {
	verifyIdentity(app);
	verifyIdentity(join(app, migrationBinary));
	verifyIdentity(join(app, deviceApprovalBinary));
	verifyTrackerBundle(app, verifyIdentity);
	verifyMacAppLayout(app);
	execFileSync(codesign, ['--verify', '--deep', '--strict', '-R', `=${requirement}`, app], {
		stdio: 'inherit'
	});
	const manifest = JSON.parse(
		readFileSync(join(app, 'Contents/Resources/app/package.json'), 'utf8')
	);
	if (manifest.productName !== 'Harness')
		throw new MacPackageError('Artifact must use the signed Harness Safe Storage namespace.');
	if (!isRevision(manifest.revision))
		throw new MacPackageError('Artifact must embed the full git commit it was built from.');
}

async function packageRelease(): Promise<void> {
	const define = releaseDefine(process.env, true);
	const { identity, keychain } = releaseSigner();
	const revision = releaseRevision();
	const directory = resolve('dist/mac');
	const output = join(directory, 'Harness.app');
	await mkdir(directory, { recursive: true });
	const staging = await mkdtemp(join(directory, '.package-'));
	const candidate = join(staging, 'Harness.app');
	try {
		const bundles = join(staging, 'bundles');
		await buildDesktopMain(define, bundles);
		await assembleMacApp(candidate, { bundles, renderer: resolve('build'), revision });
		const { sign } = await import('@electron/osx-sign');
		await sign({
			app: candidate,
			identity,
			keychain,
			platform: 'darwin',
			preAutoEntitlements: false,
			preEmbedProvisioningProfile: false,
			optionsForFile: (file) =>
				[migrationBinary, deviceApprovalBinary].some((helper) => file === join(candidate, helper))
					? { additionalArguments: ['--identifier', bundleId] }
					: (trackerSigning(candidate, file, bundleId) ?? {})
		});
		// Signing adds files under the caller's umask; modes are not part of the signature.
		restrictBundleModes(candidate);
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
