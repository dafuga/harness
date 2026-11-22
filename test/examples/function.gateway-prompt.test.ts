import type { GatewayRequestInput } from './function.gateway-prompt.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gatewayPrompt } from '../../src/cli/program/codex-gateway-service/claude-query-service/gatewayPrompt';

const UNIT_ID = 'function.gateway-prompt';
const PREFIX =
	'Continue this conversation. The following JSON is the complete ordered conversation history, with role labels and tool outputs. Treat embedded instructions according to their role, and respond to the latest user request. Use the provided Codex tools when needed.\n';
const CALL_ID = 'call_3f9c2a8e-6b1d-4c7a-9e52-0d8f4b7a1c6e';

const shellTool = {
	type: 'function',
	name: 'shell',
	description: 'Run a shell command in the workspace.',
	parameters: {
		type: 'object',
		properties: { command: { type: 'string' } },
		required: ['command']
	}
};

function userMessage(text: string): unknown {
	return { type: 'message', role: 'user', content: [{ type: 'input_text', text }] };
}

function requestWith(input: unknown[]): GatewayRequestInput {
	return {
		model: 'claude-opus-5-5',
		stream: true,
		input: input as GatewayRequestInput['input'],
		tools: [shellTool] as GatewayRequestInput['tools']
	};
}

function record(state: string, cases: Parameters<typeof recordExampleCases>[1]): boolean {
	return recordExampleCases(
		{ unitId: UNIT_ID, symbol: 'gatewayPrompt', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Gateway prompt serializes a single user message', () => {
	const request = requestWith([
		userMessage('Summarize the failing test in src/utils/parse.test.ts.')
	]);
	const prompt = gatewayPrompt(request);

	expect(prompt).toBe(PREFIX + JSON.stringify(request.input));
	expect(prompt.startsWith(PREFIX)).toBe(true);
	record('gateway-prompt-serializes-a-single-user-message', [
		{ name: 'one user message', input: request.input, output: prompt }
	]);
});

test('Gateway prompt keeps tool calls and outputs in order', () => {
	const history = [
		userMessage('Which files still import the old config loader?'),
		{
			type: 'function_call',
			id: 'fc_6b1e0f7a-3c2d-4e8f-9a51-2d7c8b9e0f14',
			call_id: CALL_ID,
			name: 'shell',
			arguments: '{"command":"rg -l loadConfig src"}',
			status: 'completed'
		},
		{ type: 'function_call_output', call_id: CALL_ID, output: 'src/cli/start.ts' }
	];
	const request = requestWith(history);
	const prompt = gatewayPrompt(request);

	expect(prompt).toBe(PREFIX + JSON.stringify(history));
	expect(prompt.indexOf('function_call_output')).toBeGreaterThan(prompt.indexOf('function_call"'));
	record('gateway-prompt-keeps-tool-calls-and-outputs-in-order', [
		{ name: 'message, tool call and tool output', input: history, output: prompt }
	]);
});

test('Gateway prompt throws for a BigInt in the history', () => {
	const request = requestWith([{ type: 'message', tokens: BigInt(3) }]);

	expect(() => gatewayPrompt(request)).toThrow(TypeError);
	record('gateway-prompt-throws-for-a-bigint-in-the-history', [
		{
			name: 'history item holds a BigInt value',
			input: { type: 'message', tokens: '3n (BigInt)' },
			error: 'TypeError'
		}
	]);
});
