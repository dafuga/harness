import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Proves the Swift secure channel against the frozen vectors of the backend, without a
 * simulator: the two pure files of the plugin are compiled for this Mac with a small checker.
 */
const root = resolve(import.meta.dirname, '..');
const remote = resolve(root, 'ios/App/App/Remote');
const output = resolve(root, '.cache/ios');
const binary = resolve(output, 'remote-vectors');
const vectors = resolve(root, '../remote/test/support/secure-vectors.json');
const sources = [
	resolve(remote, 'RemoteCoding.swift'),
	resolve(remote, 'RemoteCrypto.swift'),
	resolve(root, 'ios/Checks/Vectors/main.swift')
];

function run(command: string[]): number {
	return Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
}

mkdirSync(output, { recursive: true });
const compiled = run(['xcrun', 'swiftc', '-O', ...sources, '-o', binary]);
process.exit(compiled === 0 ? run([binary, vectors]) : compiled);
