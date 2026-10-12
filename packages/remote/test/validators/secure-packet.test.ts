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

test('the four packet shapes are accepted exactly', () => {
	for (const packet of [hello, accept, reject, sealed])
		expect(validator.packet(packet)).toEqual(packet);
});
test('extra fields, other versions and malformed values are refused', () => {
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
	for (const packet of refused) expect(() => validator.packet(packet)).toThrow(SecureFailure);
});
test('a frame is bounded before it is parsed', () => {
	expect(validator.text(JSON.stringify(sealed))).toEqual(sealed);
	expect(() => validator.text('not json')).toThrow(SecureFailure);
	expect(() => validator.text('x'.repeat(remoteLimits.frameBytes + 1))).toThrow(SecureFailure);
});
