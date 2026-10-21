import electron from 'electron';
import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { macIcon } from './mac-icon/mac-icon';
if (process.platform !== 'darwin') throw new Error('This package target requires macOS.');
const identity = process.env.HARNESS_MAC_SIGN_IDENTITY;
if (identity !== undefined) {
	if (!/^[a-f0-9]{40}$/i.test(identity))
		throw new Error('HARNESS_MAC_SIGN_IDENTITY must be the exact certificate SHA-1 fingerprint.');
	const available = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
		encoding: 'utf8'
	});
	const fingerprints = [...available.matchAll(/^\s*\d+\)\s+([a-f0-9]{40})\s+"/gim)].map((match) =>
		match[1].toUpperCase()
	);
	if (!fingerprints.includes(identity.toUpperCase()))
		throw new Error('HARNESS_MAC_SIGN_IDENTITY is not an available code-signing identity.');
}
const original = resolve(dirname(electron as unknown as string), '../..');
const output = resolve('dist/mac/Harness.app');
await mkdir(dirname(output), { recursive: true });
await cp(original, output, { recursive: true });
const project = resolve(output, 'Contents/Resources/app');
await mkdir(project, { recursive: true });
await rm(resolve(project, 'build'), { recursive: true, force: true });
await cp('build', resolve(project, 'build'), { recursive: true });
await cp('dist/main.cjs', resolve(project, 'dist/main.cjs'));
await cp('dist/preload.cjs', resolve(project, 'dist/preload.cjs'));
await writeFile(
	resolve(project, 'package.json'),
	JSON.stringify({ name: 'harness-desktop', version: '0.1.0', main: 'dist/main.cjs' })
);
const plist = resolve(output, 'Contents/Info.plist');
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleDisplayName Harness', plist]);
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleName Harness', plist]);
execFileSync('/usr/libexec/PlistBuddy', [
	'-c',
	'Set :CFBundleIdentifier dev.harness.desktop',
	plist
]);
await macIcon(output);
execFileSync('codesign', ['--force', '--deep', '--sign', identity ?? '-', output], {
	stdio: 'inherit'
});
execFileSync('codesign', ['--verify', '--deep', '--strict', output], { stdio: 'inherit' });
if (!identity)
	console.warn(
		'Ad-hoc signing: updates can prompt for Keychain access again. Set HARNESS_MAC_SIGN_IDENTITY to reuse a certificate.'
	);
console.log(output);
