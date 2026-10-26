import { test } from 'vitest';
import {
	componentManifestSchema,
	type ComponentManifest
} from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import manifest from '../fixtures/contract-migration/resource-request-examples.json' with { type: 'json' };
import { invokeResourceRequest } from '../support/resourceRequestExamples';

// Admit JSON before narrowing its inferred heterogeneous object unions.
componentManifestSchema.parse(manifest);
new TestExpectationService().registerExamples(test, manifest as unknown as ComponentManifest, {
	resourceRequest: invokeResourceRequest
});
