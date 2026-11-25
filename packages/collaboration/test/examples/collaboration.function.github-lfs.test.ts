import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { expect } from '../../../../test/verificationExpect';
import {
	encode,
	observe,
	record,
	installationToken
} from './collaboration.function.github-lfs.cases';
export { sentOf, observe } from './collaboration.function.github-lfs.cases';

const batchUrl = 'https://github.com/acme/pilot.git/info/lfs/objects/batch';
const cdnHref = 'https://objects.githubusercontent.com/example/hello';
const s3Href = 'https://github-cloud.s3.amazonaws.com/example/s3';
const mediaHref = 'https://media.githubusercontent.com/example/empty';
const pointerPrefix = 'version https://git-lfs.github.com/spec/v1\n';
const helloText = 'Hello from LFS.\n';
/** A lowercase 64-character OID that no example object has, so only a batch reply can name it. */
const foreignOid = '0123456789abcdef'.repeat(4);
const invalid = 'invalid-lfs-pointer';
const unavailable = 'lfs-unavailable';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pointerTo = (oid: string, size: number) =>
	encode(`${pointerPrefix}oid sha256:${oid}\nsize ${size}\n`);
/** The batch reply for one object: one download action, with optional headers for the storage. */
const batchReply = (oid: string, size: number, href: string, header?: object) => ({
	status: 200,
	json: { objects: [{ oid, size, actions: { download: { href, header } } }] }
});

/** A download that the batch endpoint offers at href and the storage then serves in full. */
const offering = (name: string, bytes: Uint8Array, href: string, header?: object) => {
	const [oid, size] = [sha256(bytes), bytes.length];
	const reply = { status: 200, text: new TextDecoder().decode(bytes) };
	return observe(name, pointerTo(oid, size), [batchReply(oid, size, href, header), reply]);
};

test('Downloads a pointed-to object whose size and hash match', async () => {
	const hello = encode(helloText);
	const storage = encode('Stored on the S3 host.\n');
	const empty = new Uint8Array(0);
	const storageHeader = { 'X-Example-Storage': 'object-scope' };
	const calls = [
		await offering('a text object from githubusercontent.com', hello, cdnHref, storageHeader),
		await offering('an object from the S3 storage host', storage, s3Href),
		await offering('a zero-byte object downloads as empty bytes', empty, mediaHref)
	];
	record('downloads-a-pointed-to-object-whose-size-and-hash-match', calls);
	const [batch, download] = calls[0].outcome.requests;
	expect(calls.map(({ outcome }) => outcome.value)).toEqual([hello, storage, empty]);
	expect([batch.method, batch.url, batch.redirect]).toEqual(['POST', batchUrl, 'manual']);
	expect([download.method, download.url, download.redirect]).toEqual(['GET', cdnHref, 'manual']);
	expect(batch.body).toEqual({
		operation: 'download',
		transfers: ['basic'],
		objects: [{ oid: sha256(hello), size: hello.length }]
	});
	expect(batch.headers?.Authorization).toBe(`Basic ${btoa(`x-access-token:${installationToken}`)}`);
	expect(download.headers).toEqual(storageHeader);
	expect(calls[0].outcome.tokens).toEqual([
		{ installationId: 7, repositoryIds: [202], permissions: { contents: 'read' } }
	]);
});

test('Rejects malformed pointers and sizes over the limit', async () => {
	const oid = sha256(encode(helloText));
	const v2 = encode(`version https://git-lfs.github.com/spec/v2\noid sha256:${oid}\nsize 16\n`);
	const padded = encode(`${pointerPrefix}oid sha256:${oid}\nsize 016\n`);
	const calls = [
		await observe('a version 2 pointer is refused', v2),
		await observe('an uppercase object ID is refused', pointerTo(oid.toUpperCase(), 16)),
		await observe('a size with a leading zero is refused', padded),
		await observe('a size one byte over the limit is refused', pointerTo(oid, 50_000_001))
	];
	record('rejects-malformed-pointers-and-sizes-over-the-limit', calls);
	expect(calls.map(({ outcome }) => outcome.code)).toEqual([
		invalid,
		invalid,
		invalid,
		'lfs-size-limit'
	]);
	expect(calls.flatMap(({ outcome }) => [...outcome.requests, ...outcome.tokens])).toEqual([]);
});

test('Refuses a download URL that is not a permitted HTTPS host', async () => {
	const hello = encode(helloText);
	const refuse = (name: string, href: string) => offering(name, hello, href);
	const calls = [
		await refuse('an http URL is refused', 'http://objects.githubusercontent.com/x'),
		await refuse('credentials are refused', 'https://a:b@objects.githubusercontent.com/x'),
		await refuse('an explicit port is refused', 'https://objects.githubusercontent.com:8443/x'),
		await refuse('a lookalike host is refused', 'https://githubusercontent.com.example.net/x')
	];
	record('refuses-a-download-url-that-is-not-a-permitted-https-host', calls);
	expect(calls.map(({ outcome }) => outcome.code)).toEqual(Array(4).fill(unavailable));
	expect(calls.map(({ outcome }) => outcome.requests.length)).toEqual([1, 1, 1, 1]);
});

test('Reports lfs-unavailable when bytes do not match the pointer', async () => {
	const hello = encode(helloText);
	const oid = sha256(hello);
	const size = hello.length;
	const blob = pointerTo(oid, size);
	const offer = batchReply(oid, size, cdnHref);
	const foreign = batchReply(foreignOid, size, cdnHref);
	const text = (value: string) => ({ status: 200, text: value });
	const other = 'Hallo from LFS.\n';
	const calls = [
		await observe('a download one byte too long is refused', blob, [offer, text(`${helloText}!`)]),
		await observe('a download with other bytes is refused', blob, [offer, text(other)]),
		await observe('a batch reply naming another object is refused', blob, [
			foreign,
			text(helloText)
		])
	];
	record('reports-lfs-unavailable-when-bytes-do-not-match-the-pointer', calls);
	expect(calls.map(({ outcome }) => outcome.code)).toEqual(Array(3).fill(unavailable));
	expect(calls.map(({ outcome }) => outcome.requests.length)).toEqual([2, 2, 1]);
});

test('Reports lfs-unavailable when token, transfer or reply fails', async () => {
	const hello = encode(helloText);
	const oid = sha256(hello);
	const size = hello.length;
	const blob = pointerTo(oid, size);
	const limit = pointerTo(oid, 50_000_000);
	const offer = batchReply(oid, size, cdnHref);
	const objectError = { status: 200, json: { objects: [{ oid, size, error: { code: 404 } }] } };
	const redirect = { status: 302, headers: { location: cdnHref } };
	const calls = [
		await observe('a token that cannot be acquired is refused', blob, [], true),
		await observe('a size at the 50000000 limit gets a 503', limit, [{ status: 503 }]),
		await observe('an object error without a download action is refused', blob, [objectError]),
		await observe('a download redirect is refused, not followed', blob, [offer, redirect])
	];
	record('reports-lfs-unavailable-when-token-transfer-or-reply-fails', calls);
	expect(calls.map(({ outcome }) => outcome.code)).toEqual(Array(4).fill(unavailable));
	expect(calls.map(({ outcome }) => outcome.tokens.length)).toEqual([1, 1, 1, 1]);
	expect(calls.map(({ outcome }) => outcome.requests.length)).toEqual([0, 1, 1, 2]);
	expect(calls[1].outcome.requests[0].body).toMatchObject({ objects: [{ size: 50_000_000 }] });
	expect(calls[3].outcome.requests[1].redirect).toBe('manual');
});
