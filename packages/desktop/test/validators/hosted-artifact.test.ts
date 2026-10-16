import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { artifactLimit } from '../../src/utils/artifactMedia';
import { HostedArtifactValidator } from '../../src/validators/HostedArtifactValidator';

const validator = new HostedArtifactValidator();
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const text = (value: string) => new TextEncoder().encode(value);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const wave = text('RIFF0000WAVEfmt ');
const json = text('{"ok":true}');
const html = text('<!doctype html><script>alert(1)</script>');
const plain = 'text/plain; charset=utf-8';
/** What the validator makes of bytes received as a media type, asked for by their own hash. */
const check = (bytes: Uint8Array, mediaType: string, asked = sha256(bytes)) =>
	validator.artifact({ bytes, mediaType }, asked);

test('what the hub attested is accepted for the kinds of file this app shows, each under one name', () => {
	const shown: Array<[Uint8Array, string, string]> = [
		[png, 'image/png', 'image/png'],
		[jpeg, 'image/jpeg', 'image/jpeg'],
		[wave, 'audio/wav', 'audio/wav'],
		[json, 'application/json', 'application/json'],
		[json, 'application/json; charset=utf-8', 'application/json'],
		[json, plain, plain],
		[text('plain words'), 'text/plain', plain],
		// Markup that was recorded as a result is text to read, and is never served as markup.
		[html, 'Text/Plain;charset=UTF-8', plain]
	];
	for (const [bytes, stated, served] of shown)
		expect(check(bytes, stated)).toEqual({ bytes, mediaType: served, sha256: sha256(bytes) });
});

test('a media type this app does not show, or one the bytes are not, is refused', () => {
	const unshown: Array<[Uint8Array, string]> = [
		[html, 'text/html'],
		[html, 'text/html; charset=utf-8'],
		[html, 'application/xhtml+xml'],
		[text('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'],
		[json, 'text/javascript'],
		[png, 'application/octet-stream'],
		[png, ''],
		[json, 'constructor'],
		[html, 'image/png'],
		[png, 'image/jpeg'],
		[png, 'audio/wav'],
		[wave, 'audio/x-wav'],
		[text('not json'), 'application/json'],
		[new Uint8Array([0, 1, 2]), plain],
		[png, 'image/png; charset=utf-8'],
		[json, 'application/json; boundary=x']
	];
	for (const [bytes, stated] of unshown)
		expect(() => check(bytes, stated), stated).toThrow(/does not show/);
});

test('bytes that do not have the hash that was asked for are refused', () => {
	const changed = new Uint8Array(png);
	changed[changed.length - 1] ^= 1;
	expect(() => check(changed, 'image/png', sha256(png))).toThrow(/SHA-256/);
	expect(() => check(json, 'application/json', sha256(png))).toThrow(/SHA-256/);
	expect(() => check(png, 'image/png', 'HEAD')).toThrow(/SHA-256/);
	expect(() => check(new Uint8Array(0), 'image/png', sha256(png))).toThrow(/SHA-256/);
});

test('eleven MiB is the most one capture may be, and more is refused before it is hashed', () => {
	const most = new Uint8Array(artifactLimit).fill(97);
	expect(check(most, plain).bytes.length).toBe(artifactLimit);
	const more = new Uint8Array(artifactLimit + 1).fill(97);
	expect(() => check(more, plain)).toThrow(/11 MiB/);
	expect(() => check(more, plain, 'not a hash')).toThrow(/11 MiB/);
});
