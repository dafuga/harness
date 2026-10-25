import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../test/fixtures/contract-migration/remote-label-examples.json';
import { remoteLabels, grantSummary } from '../../src/components/remote-phone-panel/remoteLabels';
import {
	hostLine,
	hostSummary,
	relayName
} from '../../src/components/remote-host-panel/remoteLabels';
import { timeLeft } from '../../src/components/remote-offer-code/remoteLabels';
import { grantLabel, identityLabel, keyLabel, plural } from '../../src/utils/remoteLabels';

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	grantLabel,
	grantSummary,
	hostLine,
	hostSummary,
	identityLabel,
	keyLabel,
	plural,
	remoteLabels,
	relayName,
	timeLeft
});
