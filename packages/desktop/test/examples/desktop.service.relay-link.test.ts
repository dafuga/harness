import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RelayLinkService } from '../../src/services/networking-security/remote-host-service/relay-link-service/RelayLinkService';
import type { RelayLinkOptions } from '../../src/services/networking-security/remote-host-service/relay-link-service/RelayLinkService.types';

function setup() {
	let message: (text: string) => void = () => undefined;
	const writes: string[] = [];
	const socket = {
		opened: Promise.resolve(),
		onMessage: (handler: (text: string) => void) => { message = handler; },
		onClose: (_handler: () => void) => undefined,
		send: (text: string) => { writes.push(text); },
		close: (_code: number) => undefined
	} as ReturnType<RelayLinkOptions['open']>;
	const service = new RelayLinkService({
		origin: 'https://relay.example.test', hostId: 'a3f81c0e6d92b47f15e0c8a7d9b36e2f4c1a07d5', credential: 'example-token',
		open: () => socket, onFrame: () => undefined, onState: () => undefined, ackMs: 100
	});
	return { service, writes, deliver: (text: string) => message(text) };
}

test('Throws The relay is not connected when command is called offline', async () => {
	const { service } = setup();
	const input = { type: 'device-revoke', deviceId: 'a3f81c0e6d92b47f15e0c8a7d9b36e2f4c1a07d5' } as const;
	await expect(service.command(input)).rejects.toThrow('The relay is not connected.');
	recordExampleCases({ unitId: 'desktop.service.relay-link', symbol: 'command', state: 'throws-the-relay-is-not-connected-when-command-is-called-off', evidence: 'examples-cases', file: 'throws-the-relay-is-not-connected-when-command-is-called-off.json' }, [
		{ name: 'Command while offline', input, error: 'The relay is not connected.' }
	]);
});

test('Throws The relay did not answer when acknowledgement times out', async () => {
	vi.useFakeTimers();
	try {
		const { service, writes } = setup();
		service.start();
		await Promise.resolve();
		const input = { type: 'device-revoke', deviceId: 'a3f81c0e6d92b47f15e0c8a7d9b36e2f4c1a07d5' } as const;
		const pending = service.command(input);
		const rejection = expect(pending).rejects.toThrow('The relay did not answer.');
		await vi.advanceTimersByTimeAsync(101);
		await rejection;
		service.stop();
		recordExampleCases({ unitId: 'desktop.service.relay-link', symbol: 'command', state: 'throws-the-relay-did-not-answer-when-acknowledgement-times-o', evidence: 'examples-cases', file: 'throws-the-relay-did-not-answer-when-acknowledgement-times-o.json' }, [
			{ name: 'Command without acknowledgement', input: { command: input, sent: writes.length }, error: 'The relay did not answer.' }
		]);
	} finally {
		vi.useRealTimers();
	}
});

test('Throws refused when relay rejects the acknowledgement', async () => {
	const { service, writes, deliver } = setup();
	service.start();
	await Promise.resolve();
	const input = { type: 'device-revoke', deviceId: 'a3f81c0e6d92b47f15e0c8a7d9b36e2f4c1a07d5' } as const;
	const pending = service.command(input);
	const sent = JSON.parse(writes[0]) as { ref: string };
	deliver(JSON.stringify({ type: 'ack', ref: sent.ref, ok: false }));
	await expect(pending).rejects.toThrow('refused');
	service.stop();
	recordExampleCases({ unitId: 'desktop.service.relay-link', symbol: 'command', state: 'throws-refused-when-relay-rejects-the-acknowledgement', evidence: 'examples-cases', file: 'throws-refused-when-relay-rejects-the-acknowledgement.json' }, [
		{ name: 'Command with negative acknowledgement', input: { command: input, ack: { ok: false } }, error: 'refused' }
	]);
});
