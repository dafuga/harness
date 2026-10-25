import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../specification/units/remote.service.device-pairing.json' with { type: 'json' };
import { DevicePairingService } from '../../src/services/device-pairing-service/DevicePairingService';
import { setup } from '../support/devicePairingFixture';
import { scanInitialized, requestedScan, startAfter } from '../support/devicePairingScan';
import { requestInitialized, requestedRequest } from '../support/devicePairingRequest';
import { pollState, exchangeRejected, exchangeApproved } from '../support/devicePairingLifecycle';

new TestExpectationService().registerCases(
	test,
	unit as ComponentManifest,
	'packages/remote/test/services/device-pairing.test.ts',
	{
		'scanned-initialized': scanInitialized,
		'request-initialized': requestInitialized,
		'poll-initialized': async () => pollState('initialized'),
		'exchange-initialized': async () => {
			expect(new DevicePairingService()).toBeInstanceOf(DevicePairingService);
			await expect((await setup()).device.exchange(undefined as never)).rejects.toThrow(TypeError);
		},
		'scanned-requested': requestedScan,
		'request-requested': requestedRequest,
		'poll-requested': async () => pollState('requested'),
		'exchange-requested': async () => exchangeRejected('requested'),
		'scanned-approved': async () => startAfter('approved', true),
		'request-approved': async () => startAfter('approved', false),
		'poll-approved': async () => pollState('approved'),
		'exchange-approved': exchangeApproved,
		'scanned-denied': async () => startAfter('denied', true),
		'request-denied': async () => startAfter('denied', false),
		'poll-denied': async () => pollState('denied'),
		'exchange-denied': async () => exchangeRejected('denied'),
		'scanned-exchanged': async () => startAfter('exchanged', true),
		'request-exchanged': async () => startAfter('exchanged', false),
		'poll-exchanged': async () => pollState('exchanged'),
		'exchange-exchanged': async () => exchangeRejected('exchanged')
	}
);
