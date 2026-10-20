import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { RemoteBinary } from '../../src/models/Environment.types';
import {
	artifactLimit,
	artifactMediaTypes,
	largeArtifact,
	otherArtifact,
	unshownArtifact
} from '../../src/utils/remoteArtifact';
import { remoteArtifact } from '../../src/adapters/capacitor-bridge-adapter/remoteArtifact';
import { damagedMedia, unreadableMedia } from '../../src/utils/remoteBinary';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sent = (bytes: Uint8Array, mediaType = 'application/json'): RemoteBinary => ({
	encoding: 'base64',
	mediaType,
	byteLength: bytes.length,
	sha256: hash(bytes),
	data: Buffer.from(bytes).toString('base64')
});
const recorded = new TextEncoder().encode('{"ok":true}');
const asked = hash(recorded);
const mebibyte = 1024 * 1024;

test('a recorded artifact is decoded to exactly its bytes, with its own media type and hash', async () => {
	for (const mediaType of artifactMediaTypes) {
		const read = await remoteArtifact(sent(recorded, mediaType), asked);
		expect(Array.from(read.bytes)).toEqual(Array.from(recorded));
		expect({ mediaType: read.mediaType, sha256: read.sha256 }).toEqual({
			mediaType,
			sha256: asked
		});
	}
});

test('the media types of an artifact are one fixed list of pictures, sound, data and text', () => {
	expect([...artifactMediaTypes].sort()).toEqual([
		'application/json',
		'audio/mp4',
		'audio/mpeg',
		'audio/ogg',
		'audio/wav',
		'image/jpeg',
		'image/png',
		'text/plain; charset=utf-8'
	]);
	expect(artifactLimit).toBe(11 * mebibyte);
});

test('markup, scripts and unnamed types are refused, though their bytes are intact', async () => {
	const refused = [
		'text/html',
		'text/html; charset=utf-8',
		'application/xhtml+xml',
		'image/svg+xml',
		'text/javascript',
		'application/javascript',
		'application/octet-stream',
		'application/json; charset=utf-8, text/html',
		''
	];
	for (const mediaType of refused)
		await expect(remoteArtifact(sent(recorded, mediaType), asked)).rejects.toThrow(unshownArtifact);
	const unnamed = { ...sent(recorded), mediaType: undefined } as unknown as RemoteBinary;
	await expect(remoteArtifact(unnamed, asked)).rejects.toThrow(unshownArtifact);
});

test('bytes that differ from their stated hash or length are refused', async () => {
	const other = Buffer.from(new TextEncoder().encode('{"ok":false}')).toString('base64');
	await expect(remoteArtifact({ ...sent(recorded), data: other }, asked)).rejects.toThrow(
		damagedMedia
	);
	const longer = { ...sent(recorded), byteLength: recorded.length + 1 };
	await expect(remoteArtifact(longer, asked)).rejects.toThrow(damagedMedia);
	const renamed = { ...sent(recorded), sha256: 'f'.repeat(64) };
	await expect(remoteArtifact(renamed, 'f'.repeat(64))).rejects.toThrow(damagedMedia);
});

test('an intact artifact that is not the one asked for is refused', async () => {
	const stale = new TextEncoder().encode('{"ok":"earlier notes"}');
	await expect(remoteArtifact(sent(stale), asked)).rejects.toThrow(otherArtifact);
	await expect(remoteArtifact(sent(recorded), undefined as never)).rejects.toThrow(otherArtifact);
});

test('an artifact of 11 MiB is read, and one byte more is refused as too large', async () => {
	const most = new Uint8Array(artifactLimit).fill(7);
	const read = await remoteArtifact(sent(most, 'image/png'), hash(most));
	expect(read.bytes.length).toBe(11 * mebibyte);
	const more = new Uint8Array(11 * mebibyte + 1).fill(7);
	/** Only the words are compared: a wrongly read artifact of this size is not printed. */
	const refusal = await remoteArtifact(sent(more, 'image/png'), hash(more)).then(
		() => 'read',
		(cause: Error) => cause.message
	);
	expect(refusal).toBe(largeArtifact);
}, 30_000);

test('another encoding, broken base64 or no answer at all is refused', async () => {
	const hex = { ...sent(recorded), encoding: 'hex' } as unknown as RemoteBinary;
	await expect(remoteArtifact(hex, asked)).rejects.toThrow(unreadableMedia);
	await expect(remoteArtifact({ ...sent(recorded), data: '%%%' }, asked)).rejects.toThrow(
		unreadableMedia
	);
	await expect(remoteArtifact(null as unknown as RemoteBinary, asked)).rejects.toThrow();
});

test('each refusal says why in words of its own', () => {
	const words = [unshownArtifact, largeArtifact, otherArtifact, damagedMedia, unreadableMedia];
	for (const text of words) expect(text.length).toBeGreaterThan(20);
	expect(new Set(words).size).toBe(words.length);
});
