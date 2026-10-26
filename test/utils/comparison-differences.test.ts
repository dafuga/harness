import { test } from 'vitest';
import { comparisonDifferences } from '../../src/services/budget-service/comparisonDifferences';

import manifest from '../fixtures/contract-migration/comparison-differences-examples.json';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../src/core/unitTypes';

// Every authored Example in the manifest registers one case. The callable is imported through the
// public budget-service alias that the original suite used.
new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	comparisonDifferences
});
