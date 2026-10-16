import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Proves the Swift secure channel against the frozen vectors of the backend, without a
 * simulator: the pure files of the plugin are compiled for this Mac with a small checker. The
 * reader of a scanned offer is held to the vectors TypeScript is held to.
 */
const root = resolve(import.meta.dirname, '..');
const remote = resolve(root, 'ios/App/App/Remote');
const output = resolve(root, '.cache/ios');
const binary = resolve(output, 'remote-vectors');
const vectors = resolve(root, '../remote/test/support/secure-vectors.json');
/** The offers a phone reads from a QR code, judged by TypeScript and by Swift alike. */
const offers = resolve(root, '../remote/test/support/offer-vectors.json');
const sources = [
	resolve(remote, 'RemoteCoding.swift'),
	resolve(remote, 'RemoteCrypto.swift'),
	resolve(remote, 'RemoteOffer.swift'),
	resolve(root, 'ios/Checks/Vectors/OfferVectors.swift'),
	resolve(root, 'ios/Checks/Vectors/main.swift')
];

function run(command: string[]): number {
	return Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
}

mkdirSync(output, { recursive: true });
const compiled = run(['xcrun', 'swiftc', '-O', ...sources, '-o', binary]);
process.exit(compiled === 0 ? run([binary, vectors, offers]) : compiled);
