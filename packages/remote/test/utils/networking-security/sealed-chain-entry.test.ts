import { expect, test } from 'vitest';
import {
	chainEntryHash,
	sealedCanonical,
	sealedChainEntry,
	verifyChainEntry
} from '../../../src/utils/networking-security/sealedChainEntry';
import { sealedDevice } from '../../../src/utils/networking-security/sealedDevice';
import { toBase64Url } from '../../../src/utils/networking-security/remoteBytes';

test('canonical JSON sorts keys at every depth and drops undefined fields', () => {
	expect(sealedCanonical({ b: 1, a: { d: [2, { z: 1, y: 'x' }], c: undefined } })).toBe(
		'{"a":{"d":[2,{"y":"x","z":1}]},"b":1}'
	);
});

test('a signed entry verifies only with its signer key and unchanged content', async () => {
	const signer = await sealedDevice(),
		other = await sealedDevice();
	const entry = await sealedChainEntry(signer, {
		seq: 1,
		prev: 'ab',
		at: 5,
		by: 'ignored',
		body: { type: 'revoke', device: 'd1' }
	});
	expect(entry.by).toBe(signer.deviceId);
	const key = toBase64Url(signer.signingPublic);
	expect(await verifyChainEntry(entry, key)).toBe(true);
	expect(await verifyChainEntry(entry, toBase64Url(other.signingPublic))).toBe(false);
	expect(await verifyChainEntry({ ...entry, body: { type: 'revoke', device: 'd2' } }, key)).toBe(
		false
	);
	expect(await verifyChainEntry({ ...entry, seq: 2 }, key)).toBe(false);
	expect(await verifyChainEntry({ ...entry, sig: 'AAAA' }, key)).toBe(false);
	expect(await verifyChainEntry(entry, 'not-a-key')).toBe(false);
	expect(await chainEntryHash(entry)).toMatch(/^[0-9a-f]{64}$/);
});
