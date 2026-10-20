import { expect, test } from 'vitest';
import { SecureFailure } from '../../src/models/RemoteSecure.types';
import { bytesText, fromBase64Url, remoteBytes } from '../../src/utils/remoteBytes';
import { aesKey } from '../../src/utils/remoteKeys';
import { openPacket, sealPacket } from '../../src/services/secure-channel-service/sealPacket';
import type { SealContext } from '../../src/utils/sealPacket';

const context = async (fill = 7): Promise<SealContext> => ({
	key: await aesKey(new Uint8Array(32).fill(fill)),
	direction: 'd2h',
	counter: 5,
	more: false
});

test('a sealed packet opens only with the same key, direction, counter and flag', async () => {
	const base = await context(),
		data = await sealPacket(base, remoteBytes('payload'));
	expect(bytesText(await openPacket(base, data))).toBe('payload');
	const others: SealContext[] = [
		{ ...base, counter: 6 },
		{ ...base, more: true },
		{ ...base, direction: 'h2d' },
		{ ...base, key: (await context(8)).key }
	];
	for (const other of others)
		await expect(openPacket(other, data)).rejects.toBeInstanceOf(SecureFailure);
});
test('tampered or malformed data is refused', async () => {
	const base = await context(),
		data = await sealPacket(base, remoteBytes('payload'));
	const flipped = (data[0] === 'A' ? 'B' : 'A') + data.slice(1);
	for (const bad of [flipped, data.slice(0, -4), 'AAAA', '***', ''])
		await expect(openPacket(base, bad)).rejects.toBeInstanceOf(SecureFailure);
});
test('the ciphertext is the plaintext plus a 16-byte tag and differs per counter', async () => {
	const base = await context(),
		plain = remoteBytes('twelve bytes');
	const data = await sealPacket(base, plain);
	expect(fromBase64Url(data)).toHaveLength(plain.length + 16);
	expect(await sealPacket({ ...base, counter: 6 }, plain)).not.toBe(data);
	expect(await sealPacket(base, plain)).toBe(data);
});
