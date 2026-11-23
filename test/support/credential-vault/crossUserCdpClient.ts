import { once } from 'node:events';
import { createInterface } from 'node:readline';
import WebSocket from 'ws';
import type { VaultAttachment } from '../../../src/services/accounts-access/VaultLeaseKeeperService.types';

async function attachmentFromPipe(): Promise<VaultAttachment> {
	const input = createInterface({ input: process.stdin });
	try {
		const [line] = await once(input, 'line', { signal: AbortSignal.timeout(90_000) });
		return JSON.parse(line) as VaultAttachment;
	} finally {
		input.close();
		process.stdin.pause();
	}
}

async function inspectSyntheticRoster(attachment: VaultAttachment): Promise<void> {
	const socket = new WebSocket(attachment.endpoint, {
		headers: attachment.headers,
		handshakeTimeout: 5_000
	});
	try {
		const signal = AbortSignal.timeout(8_000);
		await once(socket, 'open', { signal });
		const response = once(socket, 'message', { signal });
		socket.send(JSON.stringify({ id: 1, method: 'Target.getTargets' }));
		const [packet] = await response;
		const decoded = JSON.parse(packet.toString());
		const pages = decoded.result?.targetInfos?.filter(
			(target: { type: string }) => target.type === 'page'
		);
		if (
			decoded.id !== 1 ||
			pages?.length !== 1 ||
			pages[0].url !== 'https://console.example.test/roster'
		) {
			throw new Error('Unexpected synthetic CDP result.');
		}
	} finally {
		socket.on('error', () => undefined).terminate();
	}
}

async function main(): Promise<void> {
	if (process.getuid?.() !== 70) throw new Error('Expected the isolated synthetic requester.');
	await inspectSyntheticRoster(await attachmentFromPipe());
	process.stdout.write('requester-verified\n');
}

void main().catch(() => {
	// WebSocket errors can include request details. Only a fixed receipt leaves the probe.
	process.stdout.write('requester-failed\n');
	process.exitCode = 1;
});
