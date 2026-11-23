import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CodexRequestValidator } from '../../src/validators/agents-providers/CodexRequestValidator';

const validator = new CodexRequestValidator();
const request = {
	model: 'claude-opus-5-5',
	stream: true,
	input: [{ role: 'user', content: 'Summarize the last failing test output.' }]
};
const detailedRequest = {
	model: 'claude-opus-5-5',
	stream: true,
	input: [
		{ role: 'user', content: 'Explain what this function returns.' },
		{ role: 'assistant', content: 'It returns the parsed request object.' },
		{ role: 'user', content: 'Now list the fields as bullets.' }
	],
	tools: [
		{
			type: 'function',
			name: 'read_file',
			parameters: {
				type: 'object',
				properties: { path: { type: 'string' } },
				required: ['path']
			}
		}
	],
	instructions: 'Answer in plain text.',
	extra: 'removed by the schema'
};

test('Parses valid Codex requests and rejects a prohibited response id', () => {
	const parsed = validator.parse(request);
	expect(parsed).toEqual({ ...request, tools: [] });
	const detailed = validator.parse(detailedRequest);
	expect(detailed).not.toHaveProperty('extra');
	let error: unknown;
	try {
		validator.parse({ ...request, previous_response_id: 'resp_example' });
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error & { name: string };
	expect(actual.name).toBe('ZodError');
	recordExampleCases(
		{
			unitId: 'validator.codex-request',
			symbol: 'CodexRequestValidator.parse',
			state: 'parses-valid-codex-requests-and-rejects-a-prohibited-respons',
			evidence: 'examples-cases',
			file: 'parses-valid-codex-requests-and-rejects-a-prohibited-respons.json'
		},
		[
			{ name: 'defaults omitted tools', input: request, output: parsed },
			{ name: 'strips undeclared key', input: detailedRequest, output: detailed },
			{
				name: 'rejects previous_response_id',
				input: { ...request, previous_response_id: 'resp_example' },
				error: { name: actual.name, message: actual.message }
			}
		]
	);
});
