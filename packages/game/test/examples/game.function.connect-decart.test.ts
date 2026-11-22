import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { decartTransportReady, DecartStreamAdapter, connectDecart } from '../../src/adapters/agents-providers/DecartStreamAdapter';
import type { VideoConnection, VideoConnector } from '../../src/adapters/agents-providers/DecartStreamAdapter.types';

const session = {
	apiKey: 'ephemeral-key-example-0001',
	expiresAt: '2026-11-15T12:01:00.000Z',
	model: 'lucy-2.5' as const,
	fast: false,
	seconds: 30,
	rate: 0.02
};

function makeStream(track: { stop(): void }): MediaStream {
	return { getTracks: () => [track] } as unknown as MediaStream;
}

function makeCanvas(source: MediaStream): HTMLCanvasElement {
	return { captureStream: (rate: number) => (rate === 25 ? source : source) } as unknown as HTMLCanvasElement;
}

test('reports safe transport unavailable', () => {
	const output = decartTransportReady();
	expect(output).toBe(false);
	recordExampleCases(
		{
			unitId: 'game.function.connect-decart',
			symbol: 'decartTransportReady',
			state: 'reports-safe-transport-unavailable',
			evidence: 'examples-cases',
			file: 'reports-safe-transport-unavailable.json'
		},
		[{ name: 'no credential-safe transport is registered', input: null, output }]
	);
});

test('connect forwards canvas session prompt and remote stream', async () => {
	vi.stubGlobal('document', {
		hidden: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined
	});
	const stopped: string[] = [];
	const local = makeStream({ stop: () => stopped.push('local') });
	const remote = makeStream({ stop: () => stopped.push('remote') });
	const canvas = makeCanvas(local);
	let options: Parameters<VideoConnector>[1] | undefined;
	let received: MediaStream | undefined;
	const connection: VideoConnection = {
		disconnect: () => stopped.push('disconnect'),
		setPrompt: async () => undefined,
		on: () => undefined
	};
	const adapter = new DecartStreamAdapter(canvas);
	try {
		const controls = await adapter.connect(
			session,
			{ prompt: 'a quiet harbor at dawn in soft watercolor', connector: async (_source, supplied) => { options = supplied; supplied.onRemoteStream(remote); return connection; } },
			(stream) => { received = stream; }
		);
		expect(options?.session).toEqual(session);
		expect(options?.retries).toBe(0);
		expect(received).toBe(remote);
		controls.stop();
		controls.stop();
		expect(stopped).toEqual(['disconnect', 'local', 'remote']);
		recordExampleCases(
			{
				unitId: 'game.function.connect-decart',
				symbol: 'DecartStreamAdapter.connect',
				state: 'connect-forwards-canvas-session-prompt-and-remote-stream',
				evidence: 'examples-cases',
				file: 'connect-forwards-canvas-session-prompt-and-remote-stream.json'
			},
			[{ name: 'connector receives bounded session and remote stream is delivered', input: { session, prompt: 'a quiet harbor at dawn in soft watercolor' }, output: { retries: options?.retries, capacityRetryBudgetMs: options?.capacityRetryBudgetMs, remoteDelivered: received === remote, stopped } }]
		);
	} finally {
		vi.unstubAllGlobals();
	}
});

test('connectDecart rejects prompts without a connector', async () => {
	const local = makeStream({ stop: () => undefined });
	let message = '';
	try {
		await connectDecart(makeCanvas(local), session, 'slow pan across a foggy pine forest', () => undefined);
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	}
	expect(message).toBe('Live AI is unavailable until a credential-safe provider transport is configured.');
	recordExampleCases(
		{
			unitId: 'game.function.connect-decart',
			symbol: 'connectDecart',
			state: 'connectdecart-rejects-prompts-without-a-connector',
			evidence: 'examples-cases',
			file: 'connectdecart-rejects-prompts-without-a-connector.json'
		},
		[{ name: 'string prompt cannot connect without injected transport', input: 'slow pan across a foggy pine forest', error: message }]
	);
});
