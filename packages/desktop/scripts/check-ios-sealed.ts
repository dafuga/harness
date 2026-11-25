// @harness-uid u_ytcsdpsawn
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Proves the Swift sealed layer against the TypeScript core, without a simulator. The pure files
 * of ios/App/App/Sealed are compiled for this Mac twice: with ios/Checks/Sealed, which holds them
 * to the frozen vectors of packages/remote, and with ios/Checks/SealedInterop, which the interop
 * driver runs against the TypeScript code in both directions. The Secure Enclave of this Mac is
 * used when it lets an unsigned binary create keys; otherwise those checks say they were skipped.
 */
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.cache/ios');
const vectors = resolve(root, '../remote/test/support/sealed-vectors.json');
const list = (pattern: string) =>
	[...new Bun.Glob(pattern).scanSync({ cwd: root })].sort().map((file) => resolve(root, file));
const shared = [
	resolve(root, 'ios/App/App/Remote/RemoteCoding.swift'),
	...list('ios/App/App/Sealed/*.swift'),
	...['EnrollRequest', 'EnrollApproval', 'EnrollAdmin'].map((name) =>
		resolve(root, `ios/App/App/Account/${name}.swift`)
	)
];

function run(command: string[]): number {
	return Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
}

function compile(name: string, checks: string): number {
	const sources = [...shared, ...list(`ios/Checks/${checks}/*.swift`)];
	return run(['xcrun', 'swiftc', '-O', ...sources, '-o', resolve(output, name)]);
}

mkdirSync(output, { recursive: true });
const built = compile('sealed-vectors', 'Sealed') || compile('sealed-interop', 'SealedInterop');
const checked = built || run([resolve(output, 'sealed-vectors'), vectors]);
process.exit(checked || run(['bun', resolve(root, 'scripts/check-ios-sealed-interop.ts')]));
