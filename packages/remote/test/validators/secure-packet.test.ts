import { expect, test } from 'vitest';
import { remoteLimits } from '../../src/models/Remote.types';
import { SecureFailure } from '../../src/models/RemoteSecure.types';
import { SecurePacketValidator } from '../../src/validators/SecurePacketValidator';
import { vectors } from '../support/vectors';

const validator = new SecurePacketValidator(),
	ephemeralKey = vectors.hostEphemeral.publicKey,
	nonce = vectors.hostNonce;
const hello = { type: 'hello', version: 1, deviceId: vectors.deviceId, ephemeralKey, nonce },
	accept = { type: 'accept', version: 1, ephemeralKey, nonce, generation: 3 },
	reject = { type: 'reject', reason: 'revoked' },
	sealed = { type: 'sealed', counter: 0, more: false, data: vectors.session.packets[0].data };

function expectFailure(run: () => unknown, reason: SecureFailure['reason']): void {
	try {
		run();
	} catch (error) {
		expect(error).toBeInstanceOf(SecureFailure);
		expect(error).toMatchObject({
			name: 'SecureFailure',
			reason,
			message: `Secure channel ${reason}`
		});
		return;
	}
	throw new Error(`Expected SecureFailure(${reason}).`);
}

test('packet initialized validates secure packet shapes and rejects malformed fields', () => {
	for (const packet of [hello, accept, reject, sealed])
		expect(validator.packet(packet)).toEqual(packet);
	const refused: unknown[] = [
		{ ...hello, version: 2 },
		{ ...hello, extra: 1 },
		{ ...hello, deviceId: vectors.deviceId.toUpperCase() },
		{ ...hello, ephemeralKey: ephemeralKey.slice(1) },
		{ ...hello, nonce: nonce + 'A' },
		{ ...accept, generation: -1 },
		{ ...accept, generation: 1.5 },
		{ ...accept, deviceId: vectors.deviceId },
		{ ...reject, reason: 'because' },
		{ ...sealed, counter: -1 },
		{ ...sealed, counter: 2 ** 53 },
		{ ...sealed, more: 'yes' },
		{ ...sealed, data: 'a+b/' },
		{ ...sealed, data: '' },
		{ ...sealed, data: 'A'.repeat(remoteLimits.frameBytes) },
		{ type: 'request', id: 'x', method: 'snapshot', input: {} },
		{ type: 'relay', event: 'host-online' },
		null,
		[sealed],
		'sealed'
	];
	for (const packet of refused) expectFailure(() => validator.packet(packet), 'packet');
});

test('text initialized bounds frames before parsing and returns parsed packets', () => {
	expect(validator.text(JSON.stringify(sealed))).toEqual(sealed);
	expectFailure(() => validator.text('not json'), 'packet');
	expectFailure(() => validator.text('x'.repeat(remoteLimits.frameBytes + 1)), 'size');
});
