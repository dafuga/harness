import { test } from 'vitest';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import unit from '../fixtures/contract-migration/gateway-content-error-examples.json' with { type: 'json' };
import { invokeGatewayContentError } from '../support/gatewayContentErrorExamples';

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	gatewayContentError: invokeGatewayContentError
});
