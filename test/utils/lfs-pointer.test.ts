import { test } from 'vitest';
import manifest from '../fixtures/contract-migration/lfs-pointer-examples.json' with { type: 'json' };
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { lfsPointerExampleFunctions } from '../support/lfsPointerExamples';

new TestExpectationService().registerExamples(
	test,
	manifest as ComponentManifest,
	lfsPointerExampleFunctions
);
