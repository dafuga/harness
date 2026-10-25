import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { plural } from '../../src/helpers/strings/plural';
import {
	activityDisplay,
	activityTime,
	commitHref
} from '../../src/utils/projects-sessions/activityDisplay';
import manifest from '../../../../test/fixtures/contract-migration/activity-examples.json';

// Helpers run from their canonical source; the other callables run from the unit's runtime entry.
new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	activityDisplay,
	activityTime,
	commitHref,
	plural
});
