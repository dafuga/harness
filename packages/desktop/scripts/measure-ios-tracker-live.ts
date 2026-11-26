// @harness-uid u_6cqqnlqxpd
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { macToken } from '../../hub/test/support/realtimeToken';
import type { HubFixture, HubStart } from './measure-ios-tracker-live.types';

/**
 * TEST ONLY. Times the iPhone's live chain on this Mac: a Home publish to the real Hub routes and
 * account object in local workerd, through the app's real socket, doorbell and replica, to the
 * event the page hears. The paired computer is stood in, so no relay round trip is measured.
 */
const root = resolve(import.meta.dirname, '..');
const app = (folder: string) => resolve(root, 'ios/App/App', folder);
const checks = (folder: string) => resolve(root, 'ios/Checks', folder);
const plugins = ['HarnessRemotePlugin.swift', 'HarnessAccountPlugin.swift'];
const swift = (folder: string, without: string[]) =>
	readdirSync(folder)
		.filter((name) => name.endsWith('.swift') && !without.includes(name))
		.map((name) => resolve(folder, name));
const sources = [
	...['Remote', 'Account', 'Notifications'].flatMap((name) => swift(app(name), plugins)),
	...swift(checks('Native'), ['main.swift']),
	...swift(checks('Live'), [])
];
const output = resolve(root, '.cache/ios');
const binary = resolve(output, 'tracker-live-measure');

function run(command: string, args: string[]): Promise<number> {
	return new Promise((done) => {
		spawn(command, args, { stdio: 'inherit' }).on('exit', (code) => done(code ?? 1));
	});
}

mkdirSync(output, { recursive: true });
const compiled = await run('xcrun', ['swiftc', '-O', ...sources, '-o', binary]);
if (compiled !== 0) process.exit(compiled);
// Loaded by path: the Hub's fixture is typed with Cloudflare globals this package does not have.
const fixture = fileURLToPath(new URL('../../hub/test/support/syncFixture.ts', import.meta.url));
const { startSync } = (await import(/* @vite-ignore */ fixture)) as { startSync: HubStart };
const hub: HubFixture = await startSync({
	entry: fileURLToPath(new URL('../../hub/test/support/realtimeWorker.ts', import.meta.url)),
	migrations: ['0005-hub-home-chat']
});
let code = 1;
try {
	code = await run(binary, [hub.origin, macToken]);
} finally {
	await hub.stop();
}
process.exit(code);
