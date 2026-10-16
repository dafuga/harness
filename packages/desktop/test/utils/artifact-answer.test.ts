import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { artifactAnswer } from '../../src/utils/artifactAnswer';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const limit = 11 * 1024 * 1024;
const listed = (bytes: Uint8Array, kind = 'output', mediaType = 'text/plain') => ({
	kind,
	mediaType,
	sha256: hash(bytes),
	media: `media/${hash(bytes)}.txt` as string | null
});

test('stored bytes with the recorded hash are answered with their attested media type', async () => {
	const bytes = new TextEncoder().encode('{"ok":true}');
	const capture = listed(bytes, 'assertions', 'application/json');
	const answer = await artifactAnswer(capture, bytes);
	expect(answer).toEqual({ bytes, mediaType: 'application/json', sha256: capture.sha256 });
	const plain = await artifactAnswer(listed(bytes), bytes);
	expect(plain.mediaType).toBe('text/plain; charset=utf-8');
});

test('exactly 11 MiB is answered and one byte more is refused in words', async () => {
	const exact = new Uint8Array(limit).fill(97);
	const over = new Uint8Array(limit + 1).fill(97);
	expect((await artifactAnswer(listed(exact), exact)).bytes.length).toBe(limit);
	await expect(artifactAnswer(listed(over), over)).rejects.toThrow(
		`This capture has ${limit + 1} bytes; at most ${limit} bytes (11 MiB) are read here.`
	);
});

test('bytes that are not stored, or are not the recorded ones, are never answered', async () => {
	const bytes = new TextEncoder().encode('recorded');
	const capture = listed(bytes);
	await expect(artifactAnswer(capture, undefined)).rejects.toThrow(/not stored/);
	const gap = 'media x.txt is not available locally';
	const unstored = { ...capture, media: null, gap };
	await expect(artifactAnswer(unstored, bytes)).rejects.toThrow(`not stored: ${gap}`);
	const other = new TextEncoder().encode('tampered');
	await expect(artifactAnswer(capture, other)).rejects.toThrow(/recorded SHA-256/);
	const markup = new TextEncoder().encode('<html></html>');
	await expect(artifactAnswer(listed(markup, 'screenshot', 'image/png'), markup)).rejects.toThrow(
		/screenshot/
	);
});
