import { test } from 'vitest';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import unit from '../../specification/units/function.gateway-content-error.json' with { type: 'json' };
import { invokeGatewayContentError } from '../support/gatewayContentErrorExamples';

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	gatewayContentError: invokeGatewayContentError
});
