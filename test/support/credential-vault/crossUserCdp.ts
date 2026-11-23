import { once } from 'node:events';
import { createReadStream, writeSync } from 'node:fs';
import WebSocket from 'ws';
import type { VaultAttachment } from '../../../src/services/accounts-access/VaultLeaseKeeperService.types';
import type { VaultTestRequester } from './crossUserCdp.types';

export function crossUserRequester(): VaultTestRequester | undefined {
	const runDirectory = process.env.HARNESS_TEST_VAULT_CROSS_USER_DIR;
	if (!runDirectory) return undefined;
	const uid = Number(process.env.HARNESS_TEST_VAULT_CROSS_USER_UID);
	if (!Number.isSafeInteger(uid) || uid <= 0 || uid === process.getuid?.()) {
		throw new Error('The Vault fixture needs a distinct unprivileged requester UID.');
	}
	return { runDirectory, uid };
}

export async function verifyCrossUserCdp(attachment: VaultAttachment): Promise<void> {
	const copied = new WebSocket(attachment.endpoint, {
		headers: attachment.headers,
		handshakeTimeout: 5_000
	});
	try {
		const [, refused] = await once(copied, 'unexpected-response', {
			signal: AbortSignal.timeout(6_000)
		});
		refused.resume();
		if (refused.statusCode !== 403) throw new Error('The relay admitted the wrong UID.');
	} finally {
		copied.on('error', () => undefined).terminate();
	}
	// The root-owned launcher grants these inherited pipe ends to the two test processes.
	// The attachment is transient and never becomes part of the fixture files or receipts.
	const reply = createReadStream('', { fd: 4, autoClose: false, highWaterMark: 128 });
	try {
		const result = once(reply, 'data', { signal: AbortSignal.timeout(15_000) });
		writeSync(3, JSON.stringify(attachment) + '\n');
		const [receipt] = await result;
		if (receipt.toString() !== 'requester-verified\n') {
			throw new Error('The separate requester could not use the synthetic CDP lease.');
		}
	} finally {
		reply.destroy();
	}
}
