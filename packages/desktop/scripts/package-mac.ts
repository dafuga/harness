import electron from 'electron';
import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('This package target requires macOS.');
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
execFileSync('codesign', ['--force', '--deep', '--sign', '-', output], { stdio: 'inherit' });
console.log(output);
