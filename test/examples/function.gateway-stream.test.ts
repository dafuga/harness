import { test } from 'vitest';
import type { GatewaySession } from '../../src/utils/development-tooling/gatewayTypes';
import { gatewayStream } from '../../src/cli/program/codex-gateway-service/gatewayStream';
import { CodexSessionRepository } from '../../src/cli/program/codex-gateway-service/codex-session-repository/CodexSessionRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function createSession(): GatewaySession {
	return {
		id: 'fixture-session-17',
		controller: new AbortController(),
		pending: new Map(),
		delivered: new Set(),
		running: false,
		replays: new Map()
	};
}

test('Streams text events and captures a completed replay', async () => {
	const session = createSession();
	const repository = new CodexSessionRepository();
	const context = { key: 'replay-key-17', signal: new AbortController().signal };
	const response = gatewayStream(session, repository, context);
	session.emit?.({ type: 'text', text: 'Hello from the gateway' });
	session.emit?.({ type: 'done' });
	const streamed = await response.text();
	const result = {
		contentType: response.headers.get('Content-Type'),
		cacheControl: response.headers.get('Cache-Control'),
		events: [...streamed.matchAll(/^event: ([^\n]+)/gm)].map((match) => match[1]),
		text: streamed.includes('"delta":"Hello from the gateway"'),
		completed: streamed.includes('response.completed'),
		replayStored: session.replays.has(context.key),
		callbackCleared: session.emit === undefined,
		cancelled: session.controller.signal.aborted
	};
	expect(result).toMatchObject({
		contentType: 'text/event-stream',
		cacheControl: 'no-store',
		text: true,
		completed: true,
		replayStored: true,
		callbackCleared: true,
		cancelled: false
	});
	recordExampleCases(
		{
			unitId: 'function.gateway-stream',
			symbol: 'gatewayStream',
			state: 'streams-text-events-and-captures-a-completed-replay',
			evidence: 'examples-cases',
			file: 'streams-text-events-and-captures-a-completed-replay.json'
		},
		[
			{
				name: 'text event followed by done stores the SSE transcript',
				input: { sessionId: session.id, text: 'Hello from the gateway', replayKey: context.key },
				output: result
			}
		]
	);
});
