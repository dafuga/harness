import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../specification/units/relay.function.relay-response.json' with { type: 'json' };
import { relayError, relayResponse } from '../../src/utils/relayResponse';

/** Preserve both complete JSON and exact body bytes, including the absence of a body. */
async function projectResponse(response: Response) {
	const raw = await response.text();
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		raw,
		...(raw === '' ? {} : { body: JSON.parse(raw) })
	};
}

async function invokeRelayResponse(...input: never[]) {
	const [status, body, headers] = input as unknown as Parameters<typeof relayResponse>;
	return projectResponse(relayResponse(status, body, headers));
}

async function invokeRelayError(...input: never[]) {
	const [status, error, headers] = input as unknown as Parameters<typeof relayError>;
	return projectResponse(relayError(status, error, headers));
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	relayError: invokeRelayError,
	relayResponse: invokeRelayResponse
});
