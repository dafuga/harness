// @harness-uid u_ydbpwntlfp
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { waitForCredentialBroker } from './serveCredentialBroker';
import type { CredentialBrokerOptions } from './serveCredentialBroker.types';

/** The peer add-on needs Node's accepted socket descriptor, which Bun does not expose. */
export async function runCredentialBroker(options: CredentialBrokerOptions): Promise<void> {
	if (!options.peerAddon || !process.versions.bun) {
		await waitForCredentialBroker(options);
		return;
	}
	const entries = ['./vault-broker-node.js', '../../../dist/vault-broker-node.js'];
	const script = entries
		.map((path) => fileURLToPath(new URL(path, import.meta.url)))
		.find(existsSync);
	if (!script) throw new ExpectedCliError('Build the Vault broker worker with bun run build:cli.');
	const worker = spawn('node', [script, JSON.stringify(options)], { stdio: 'inherit' });
	const stop = () => worker.kill('SIGTERM');
	process.once('SIGTERM', stop);
	process.once('SIGINT', stop);
	try {
		const [status] = await once(worker, 'exit');
		if (status !== 0) throw new ExpectedCliError('The Vault broker worker exited.');
	} finally {
		process.off('SIGTERM', stop);
		process.off('SIGINT', stop);
	}
}
