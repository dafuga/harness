import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Runs the native checks of the phone plugin on this Mac: the real Swift of the app, compiled
 * with the checks of ios/Checks/Native, once as Debug and once as Release. The Capacitor plugin
 * file is left out, as it needs UIKit; everything it calls is checked. No simulator, relay or
 * keychain is used, and nothing is installed.
 */
const root = resolve(import.meta.dirname, '..');
const remote = resolve(root, 'ios/App/App/Remote');
const checks = resolve(root, 'ios/Checks/Native');
const output = resolve(root, '.cache/ios');
const swift = (folder: string) =>
	readdirSync(folder)
		.filter((name) => name.endsWith('.swift') && name !== 'HarnessRemotePlugin.swift')
		.map((name) => resolve(folder, name));
const sources = [...swift(remote), ...swift(checks)];

function run(command: string[]): number {
	return Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
}

function flavor(name: string, flags: string[]): number {
	const binary = resolve(output, `native-checks-${name}`);
	const compiled = run(['xcrun', 'swiftc', ...flags, ...sources, '-o', binary]);
	return compiled === 0 ? run([binary]) : compiled;
}

mkdirSync(output, { recursive: true });
const debug = flavor('debug', ['-D', 'DEBUG', '-Onone']);
const release = flavor('release', ['-O']);
process.exit(debug || release);
