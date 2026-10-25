import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../test/fixtures/contract-migration/remote-label-examples.json';
import {
	remoteLabels,
	grantSummary
} from '../../src/components/networking-security/remote-phone-panel/remoteLabels';
import {
	hostLine,
	hostSummary,
	relayName
} from '../../src/components/networking-security/remote-host-panel/remoteLabels';
import { timeLeft } from '../../src/components/networking-security/remote-offer-code/remoteLabels';
import { identityLabel } from '../../src/helpers/networking-security/identityLabel';
import { plural } from '../../src/helpers/strings/plural';
import { grantLabel, keyLabel } from '../../src/utils/networking-security/remoteLabels';

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
