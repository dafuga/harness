import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { expect, test } from 'vitest';
import { VaultPeerAdapter } from '../../../src/adapters/accounts-access/VaultPeerAdapter';
import { createTempDirectory } from '../../support/temporary';

test('uid reads the Unix connection kernel identity and refuses objects without a socket', async () => {
	const directory = await createTempDirectory('harness-vault-peer-', '/tmp');
	const server = createServer();
	try {
		const binary = join(directory, 'peer.node');
		execFileSync('bash', ['deploy/vault/build-peer.sh', binary]);
		const peer = new VaultPeerAdapter({ binary });
		expect(peer.uid(new PassThrough())).toBeNull();
		const socketPath = join(directory, 'peer.sock');
		server.listen(socketPath);
		await once(server, 'listening');
		const accepted = once(server, 'connection');
		const client = connect(socketPath);
		const [socket] = await accepted;
		try {
			expect(peer.uid(socket)).toBe(process.getuid?.());
		} finally {
			client.destroy();
			socket.destroy();
		}
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		rmSync(directory, { recursive: true, force: true });
	}
});
