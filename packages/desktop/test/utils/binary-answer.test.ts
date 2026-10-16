import { expect, test } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { binaryAnswer } from '../../src/utils/binaryAnswer';
import { remoteBinary } from '../../src/utils/remoteBinary';

test('media is answered with its length and hash, and decodes to the same bytes', async () => {
	const bytes = randomBytes(70000),
		answer = binaryAnswer(bytes);
	expect(answer).toMatchObject({
		encoding: 'base64',
		mediaType: 'image/png',
		byteLength: 70000,
		sha256: createHash('sha256').update(bytes).digest('hex')
	});
	expect(Buffer.compare(Buffer.from(await remoteBinary(answer)), bytes)).toBe(0);
	await expect(remoteBinary({ ...answer, byteLength: 69999 })).rejects.toThrow();
});
