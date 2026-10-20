import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { artifactLimit } from '../../../desktop/src/utils/artifactMedia';
import { browserArtifact } from '../../src/utils/browser-bridge/browserArtifact';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const text = (value: string) => new TextEncoder().encode(value);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const wave = text('RIFF0000WAVEfmt ');

test('bytes that have the asked hash and are what their type says are given', async () => {
	const served: Array<[Uint8Array, string]> = [
		[png, 'image/png'],
		[new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
		[wave, 'audio/wav'],
		[text('{"passed":true}'), 'application/json'],
		[text('tick\n'), 'text/plain; charset=utf-8']
	];
	for (const [bytes, mediaType] of served) {
		const found = await browserArtifact({ bytes, mediaType }, hash(bytes));
		expect(found).toEqual({ bytes, mediaType, sha256: hash(bytes) });
	}
});

test('bytes with another hash than the one asked for are refused', async () => {
	const other = hash(text('other'));
	await expect(browserArtifact({ bytes: png, mediaType: 'image/png' }, other)).rejects.toThrow(
		/not the recorded file that was asked for/
	);
});

test('a type a page could run, or one the bytes are not, is refused', async () => {
	const markup = text('<html><script>alert(1)</script></html>');
	const refused: Array<[Uint8Array, string]> = [
		[markup, 'text/html'],
		[markup, 'image/png'],
		[markup, 'image/svg+xml'],
		[png, 'application/octet-stream'],
		[png, 'audio/wav'],
		[text('tick\n'), 'text/plain'],
		[text('not json'), 'application/json'],
		[png, '']
	];
	for (const [bytes, mediaType] of refused)
		await expect(browserArtifact({ bytes, mediaType }, hash(bytes))).rejects.toThrow(
			/of a kind this page does not show/
		);
});

test('more than one artifact may be is refused whatever it says it is', async () => {
	const bytes = new Uint8Array(artifactLimit + 1);
	bytes.set(png);
	await expect(browserArtifact({ bytes, mediaType: 'image/png' }, hash(bytes))).rejects.toThrow(
		/too large/
	);
});
