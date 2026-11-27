// @harness-uid u_affw5c4qje
/**
 * Writes test/support/sealed-vectors.json. Records, frames, commitments, ids, codes and chain
 * signatures come from node:crypto only, so they do not come from the WebCrypto code they check.
 * The grant uses @hpke/core (RFC 9180); the Swift side opens it with CryptoKit HPKE.
 * Run once: `bun scripts/sealed-vectors.ts`. The file is frozen; Swift must reproduce it.
 */
import { Aes256Gcm, CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import {
	createCipheriv,
	createECDH,
	createHash,
	createHmac,
	createPrivateKey,
	hkdfSync,
	sign
} from 'node:crypto';
import { writeFileSync } from 'node:fs';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const utf8 = (text: string) => Buffer.from(text, 'utf8');
const sha = (...parts: Uint8Array[]) => createHash('sha256').update(Buffer.concat(parts)).digest();
const run = (start: number, length: number) =>
	Buffer.from(Array.from({ length }, (_, index) => (start + index) & 0xff));
const u32 = (value: number) =>
	Buffer.from([value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
const u64 = (value: bigint) => {
	const bytes = Buffer.alloc(8);
	bytes.writeBigUInt64BE(value);
	return bytes;
};

function party(seed: number) {
	const ecdh = createECDH('prime256v1');
	ecdh.setPrivateKey(run(seed, 32));
	return { d: run(seed, 32), publicKey: ecdh.getPublicKey() };
}
function pad(plain: Buffer) {
	let bucket = 256;
	while (bucket < plain.length + 4) bucket *= 2;
	return Buffer.concat([u32(plain.length), plain, Buffer.alloc(bucket - plain.length - 4)]);
}
function gcm(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, plain: Uint8Array) {
	const cipher = createCipheriv('aes-256-gcm', key, nonce);
	cipher.setAAD(aad);
	return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}
const hkdf = (ikm: Uint8Array, salt: Uint8Array, info: string) =>
	Buffer.from(hkdfSync('sha256', ikm, salt, utf8(info), 32));

const scopeId = run(0x10, 16),
	epoch = 2,
	dataKey = run(0x40, 32),
	indexKey = run(0x80, 32);
const commitment = sha(utf8('harness/sealed/v1/commit\0'), scopeId, u32(epoch), dataKey, indexKey);
const objectId = createHmac('sha256', indexKey).update(utf8('item\0fx4c15')).digest();

const recordValue = { kind: 'item', title: 'Sealed vector', status: 'open' };
const salt = run(0xc0, 16),
	nonce = run(0xd0, 12),
	revision = 9n;
const prefix = Buffer.concat([
	Buffer.from([1]),
	scopeId,
	u32(epoch),
	objectId,
	u64(revision),
	salt,
	nonce
]);
const recordKey = hkdf(dataKey, salt, 'harness/sealed/v1/record');
const record = Buffer.concat([
	prefix,
	gcm(recordKey, nonce, prefix, pad(utf8(JSON.stringify(recordValue))))
]);

const streamId = run(0xe0, 16),
	counter = 3n,
	frameText = 'vector output line';
const frameHeader = Buffer.concat([Buffer.from([2]), scopeId, u32(epoch), streamId, u64(counter)]);
const frameNonce = Buffer.concat([Buffer.alloc(4), u64(counter)]);
const streamKey = hkdf(dataKey, streamId, 'harness/sealed/v1/stream');
const frame = Buffer.concat([
	frameHeader,
	gcm(streamKey, frameNonce, frameHeader, utf8(frameText))
]);

const newKem = party(0x21),
	newSigning = party(0x31),
	approver = party(0x41);
const requestNonce = run(0x50, 32),
	approverNonce = run(0x70, 32);
const enrollCommit = sha(
	utf8('harness/sealed/v1/commit-enroll\0'),
	newKem.publicKey,
	newSigning.publicKey,
	requestNonce
);
const sasHash = sha(
	utf8('harness/sealed/v1/sas\0'),
	newKem.publicKey,
	newSigning.publicKey,
	approver.publicKey,
	requestNonce,
	approverNonce
);
const sas = (sasHash.readUInt32BE(0) % 1_000_000).toString().padStart(6, '0');

const unsigned = {
	at: 1,
	body: { device: 'device-b', type: 'revoke' },
	by: 'device-a',
	prev: '',
	seq: 0
};
const signed = utf8('harness/sealed/v1/chain\0' + JSON.stringify(unsigned));
const signingKey = createPrivateKey({
	key: {
		kty: 'EC',
		crv: 'P-256',
		d: b64(approver.d),
		x: b64(approver.publicKey.subarray(1, 33)),
		y: b64(approver.publicKey.subarray(33))
	},
	format: 'jwk'
});
const sig = b64(sign('sha256', signed, { key: signingKey, dsaEncoding: 'ieee-p1363' }));
const entryHash = hex(sha(utf8(JSON.stringify({ ...unsigned, sig }))));

const grantContext = { account: 'actor-vector', device: 'device-kem', epoch, scope: b64(scopeId) };
const suite = new CipherSuite({
	kem: new DhkemP256HkdfSha256(),
	kdf: new HkdfSha256(),
	aead: new Aes256Gcm()
});
const recipientPublicKey = await suite.kem.deserializePublicKey(
	newKem.publicKey.buffer.slice(newKem.publicKey.byteOffset, newKem.publicKey.byteOffset + 65)
);
const info = utf8('harness/sealed/v1/grant\0' + JSON.stringify(grantContext));
const sealedGrant = await suite.seal(
	{ recipientPublicKey, info: info.buffer.slice(info.byteOffset, info.byteOffset + info.length) },
	Buffer.concat([dataKey, indexKey]).buffer
);

const vectors = {
	note: 'Frozen. Written by scripts/sealed-vectors.ts; see that file for which library made each value.',
	scope: {
		scopeId: b64(scopeId),
		epoch,
		dataKey: b64(dataKey),
		indexKey: b64(indexKey),
		commitment: b64(commitment)
	},
	objectId: { kind: 'item', localId: 'fx4c15', id: b64(objectId) },
	record: { envelope: b64(record), revision: revision.toString(), value: recordValue },
	frame: {
		envelope: b64(frame),
		streamId: b64(streamId),
		counter: counter.toString(),
		text: frameText
	},
	enroll: {
		kemPublic: b64(newKem.publicKey),
		signingPublic: b64(newSigning.publicKey),
		approverSigningPublic: b64(approver.publicKey),
		requestNonce: b64(requestNonce),
		approverNonce: b64(approverNonce),
		commit: hex(enrollCommit),
		sas
	},
	chainEntry: {
		entry: { ...unsigned, sig },
		signingPublic: b64(approver.publicKey),
		hash: entryHash
	},
	grant: {
		...grantContext,
		recipientD: b64(newKem.d),
		recipientPublic: b64(newKem.publicKey),
		enc: b64(new Uint8Array(sealedGrant.enc)),
		ct: b64(new Uint8Array(sealedGrant.ct))
	}
};
writeFileSync(
	new URL('../test/support/sealed-vectors.json', import.meta.url),
	JSON.stringify(vectors, null, '\t') + '\n'
);
console.log('wrote sealed vectors');
