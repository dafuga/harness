import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { RemoteBinary } from '../../src/models/Environment.types';
import { damagedMedia, remoteBinary, unreadableMedia } from '../../src/utils/remoteBinary';

const bytes = Uint8Array.from([137, 80, 78, 71, 0, 255, 1, 2]);
const sent = (): RemoteBinary => ({
	encoding: 'base64',
	mediaType: 'image/png',
	byteLength: bytes.length,
	sha256: createHash('sha256').update(bytes).digest('hex'),
	data: Buffer.from(bytes).toString('base64')
});

test('media of a computer is decoded to exactly the bytes it described', async () => {
	expect(Array.from(await remoteBinary(sent()))).toEqual(Array.from(bytes));
});

test('bytes that differ from their stated hash or length are not shown', async () => {
	await expect(remoteBinary({ ...sent(), sha256: 'f'.repeat(64) })).rejects.toThrow(damagedMedia);
	await expect(remoteBinary({ ...sent(), byteLength: bytes.length + 1 })).rejects.toThrow(
		damagedMedia
	);
	const other = Buffer.from(Uint8Array.from([1, 2, 3])).toString('base64');
	await expect(remoteBinary({ ...sent(), data: other })).rejects.toThrow(damagedMedia);
});

test('another encoding or broken base64 is refused as unreadable', async () => {
	const hex = { ...sent(), encoding: 'hex' } as unknown as RemoteBinary;
	await expect(remoteBinary(hex)).rejects.toThrow(unreadableMedia);
	await expect(remoteBinary({ ...sent(), data: '%%%' })).rejects.toThrow(unreadableMedia);
	await expect(remoteBinary(null as unknown as RemoteBinary)).rejects.toThrow(unreadableMedia);
});
