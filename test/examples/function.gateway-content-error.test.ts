import { test } from 'vitest';
import { gatewayContentError } from '../../src/utils/development-tooling/gatewayContentError';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const UNEXPECTED_MESSAGE = 'Unexpected gateway response content';
const EMPTY_MESSAGE = 'Gateway returned an empty body';

function summarise(error: Error): { name: string; message: string } {
	return { name: error.name, message: error.message };
}

test('Creates a GatewayContentError carrying the supplied message', () => {
	const unexpected = gatewayContentError(UNEXPECTED_MESSAGE);
	const empty = gatewayContentError(EMPTY_MESSAGE);

	expect(unexpected).toBeInstanceOf(Error);
	expect(unexpected.name).toBe('GatewayContentError');
	expect(unexpected.message).toBe(UNEXPECTED_MESSAGE);
	expect(empty.message).toBe(EMPTY_MESSAGE);
	recordExampleCases(
		{
			unitId: 'function.gateway-content-error',
			symbol: 'gatewayContentError',
			state: 'creates-a-gatewaycontenterror-carrying-the-supplied-message',
			evidence: 'examples-cases',
			file: 'creates-a-gatewaycontenterror-carrying-the-supplied-message.json'
		},
		[
			{
				name: 'unexpected gateway response content',
				input: UNEXPECTED_MESSAGE,
				output: summarise(unexpected)
			},
			{
				name: 'gateway returned an empty body',
				input: EMPTY_MESSAGE,
				output: summarise(empty)
			}
		]
	);
});

test('Returns the gateway content error without throwing it', () => {
	let returned: Error | undefined;

	expect(() => {
		returned = gatewayContentError(EMPTY_MESSAGE);
	}).not.toThrow();
	expect(returned).toBeInstanceOf(Error);
	expect(returned?.name).toBe('GatewayContentError');
	recordExampleCases(
		{
			unitId: 'function.gateway-content-error',
			symbol: 'gatewayContentError',
			state: 'returns-the-gateway-content-error-without-throwing-it',
			evidence: 'examples-cases',
			file: 'returns-the-gateway-content-error-without-throwing-it.json'
		},
		[
			{
				name: 'empty body message is returned, not thrown',
				input: EMPTY_MESSAGE,
				output: summarise(returned as Error)
			}
		]
	);
});
