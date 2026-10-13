import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { checkedMedia, mediaPlace } from '../../src/utils/mediaPlace';

const bytes = Buffer.from('recorded bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const gap = 'media shot.png is not available locally';

test('intact bytes are named by their hash, with the extension of their file', () => {
	expect(mediaPlace(bytes, { path: 'evidence/a/shot.PNG', sha256 }, gap)).toEqual({
		media: `media/${sha256}.png`
	});
	expect(mediaPlace(bytes, { path: 'evidence/a/output', sha256 }, gap)).toEqual({
		media: `media/${sha256}.bin`
	});
});

test('bytes that are missing, or are not the ones recorded, are the stated gap', () => {
	const file = { path: 'evidence/a/shot.png', sha256 };
	expect(mediaPlace(undefined, file, gap)).toEqual({ media: null, gap });
	expect(mediaPlace(Buffer.from('other bytes'), file, gap)).toEqual({ media: null, gap });
	expect(mediaPlace(bytes, { ...file, sha256: 'a'.repeat(64) }, gap)).toEqual({ media: null, gap });
});

test('a placer that writes nothing says the same of every capture', async () => {
	const file = { path: 'evidence/a/clip.wav', sha256 };
	expect(await checkedMedia.place(bytes, file, gap)).toEqual({ media: `media/${sha256}.wav` });
	expect(await checkedMedia.place(undefined, file, gap)).toEqual({ media: null, gap });
});
