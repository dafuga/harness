import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../test/fixtures/contract-migration/relay-connect-claims-examples.json' with { type: 'json' };
import { connectClaims } from '../../src/utils/connectClaims';

/** JSON cannot carry Headers; an input names them with a fixture marker rebuilt here. */
function headersFromFixture(marker: unknown): Headers {
	const { fixture, init } = marker as { fixture?: unknown; init?: Record<string, string> };
	if (fixture !== 'Headers' || !init) throw new Error('Unsupported Headers fixture marker');
	return new Headers(init);
}

function invokeConnectClaims(...input: never[]) {
	const [marker] = input as unknown[];
	return connectClaims(headersFromFixture(marker));
}

/**
 * Input examples read claims. Boundary examples pin near misses in credential and device
 * identifiers, letter case and ignored headers. Invalid examples refuse absent, empty, unknown or
 * malformed headers.
 */
new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	connectClaims: invokeConnectClaims
});
