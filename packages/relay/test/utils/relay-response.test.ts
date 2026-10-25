import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../test/fixtures/contract-migration/relay-response-examples.json' with {
	type: 'json'
};
import { relayError, relayResponse } from '../../src/utils/relayResponse';

async function projectResponse(response: Response) {
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		body: await response.json()
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
