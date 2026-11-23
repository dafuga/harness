import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ClaudeGatewayAdapter } from '../../src/cli/program/codex-gateway-service/ClaudeGatewayAdapter';
import { InvalidToolContinuationError } from '../../src/cli/program/codex-gateway-service/ClaudeGatewayAdapter.types';

function makeSession(running: boolean, pending = new Map<string, never>()) {
	return {
		id: 'session-example',
		controller: new AbortController(),
		pending,
		delivered: new Set<string>(),
		running,
		replays: new Map<string, string>()
	};
}

function makeRepository(deliver: (session: unknown, outputs: unknown[]) => void) {
	return { deliver } as never;
}

test('validate rejects idle tool continuations', () => {
	const adapter = new ClaudeGatewayAdapter(makeRepository(() => {}));
	const session = makeSession(false);
	const messageRequest = {
		model: 'claude-opus-5-5',
		stream: true as const,
		input: [
			{
				type: 'message',
				role: 'user',
				content: [{ type: 'input_text', text: 'List adapter files.' }]
			}
		],
		tools: []
	};
	const continuationRequest = {
		...messageRequest,
		input: [
			...messageRequest.input,
			{ type: 'function_call_output', call_id: 'call_example', output: 'ClaudeGatewayAdapter.ts' }
		]
	};
	adapter.validate(messageRequest, session);
	let error: unknown;
	try {
		adapter.validate(continuationRequest, session);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidToolContinuationError);
	expect((error as Error).message).toBe('No active query owns this continuation');
	recordExampleCases(
		{
			unitId: 'adapter.claude-gateway',
			symbol: 'ClaudeGatewayAdapter.validate',
			state: 'validate-rejects-idle-tool-continuations',
			evidence: 'examples-cases',
			file: 'validate-rejects-idle-tool-continuations.json'
		},
		[
			{ name: 'idle user message passes validation', input: messageRequest, output: null },
			{
				name: 'idle tool result is rejected',
				input: continuationRequest,
				error: 'No active query owns this continuation'
			}
		]
	);
});

test('start delivers matching tool output to a running session', () => {
	let delivered: unknown[] = [];
	const adapter = new ClaudeGatewayAdapter(
		makeRepository((_session, outputs) => {
			delivered = outputs;
		})
	);
	const session = makeSession(
		true,
		new Map([['call_6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f', { name: 'exec_command' } as never]])
	);
	const request = {
		model: 'claude-opus-5-5',
		stream: true as const,
		input: [
			{
				type: 'message',
				role: 'user',
				content: [{ type: 'input_text', text: 'List adapter files.' }]
			},
			{
				type: 'function_call_output',
				call_id: 'call_6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
				output: 'ClaudeGatewayAdapter.ts'
			}
		],
		tools: []
	};
	adapter.start(request, session);
	expect(delivered).toEqual([request.input[1]]);
	recordExampleCases(
		{
			unitId: 'adapter.claude-gateway',
			symbol: 'ClaudeGatewayAdapter.start',
			state: 'start-delivers-matching-tool-output-to-a-running-session',
			evidence: 'examples-cases',
			file: 'start-delivers-matching-tool-output-to-a-running-session.json'
		},
		[
			{
				name: 'running call receives its matching tool result',
				input: request,
				output: { deliveredCallIds: ['call_6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'] }
			}
		]
	);
});
