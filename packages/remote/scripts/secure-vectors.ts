/**
 * Writes test/support/secure-vectors.json with node:crypto only, so the vectors do not come from
 * the WebCrypto implementation they check. Run once; the file is frozen and the Swift side must
 * reproduce it. `bun scripts/secure-vectors.ts`
 */
import { createCipheriv, createECDH, createHash, hkdfSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const utf8 = (text: string) => Buffer.from(text, 'utf8');
const sha = (...parts: Uint8Array[]) => createHash('sha256').update(Buffer.concat(parts)).digest();
const run = (start: number, length: number) =>
	Buffer.from(Array.from({ length }, (_, index) => (start + index) & 0xff));

function party(seed: number) {
	const ecdh = createECDH('prime256v1');
	ecdh.setPrivateKey(run(seed, 32));
	const publicKey = ecdh.getPublicKey();
	return { ecdh, publicKey, stored: { d: b64(run(seed, 32)), publicKey: b64(publicKey) } };
}
function seal(key: Uint8Array, nonce: Uint8Array, aad: string, plain: string) {
	const cipher = createCipheriv('aes-256-gcm', key, nonce);
	cipher.setAAD(utf8(aad));
	return b64(Buffer.concat([cipher.update(utf8(plain)), cipher.final(), cipher.getAuthTag()]));
}
function counterNonce(counter: number) {
	const nonce = Buffer.alloc(12);
	nonce.writeBigUInt64BE(BigInt(counter), 4);
	return nonce;
}
const hostStatic = party(0x11),
	deviceStatic = party(0x31),
	hostEphemeral = party(0x51),
	deviceEphemeral = party(0x71),
	pairingEphemeral = party(0x91);
const hostId = hex(sha(hostStatic.publicKey)).slice(0, 40),
	deviceId = hex(sha(deviceStatic.publicKey)).slice(0, 40);
const generation = 3,
	deviceNonce = run(0xa0, 16),
	hostNonce = run(0xb0, 16);

function session() {
	const ikm = Buffer.concat([
		deviceEphemeral.ecdh.computeSecret(hostEphemeral.publicKey),
		deviceStatic.ecdh.computeSecret(hostEphemeral.publicKey),
		deviceEphemeral.ecdh.computeSecret(hostStatic.publicKey)
	]);
	const salt = sha(
		utf8(`harness-remote/v1/session\n${hostId}\n${deviceId}\n${generation}\n`),
		deviceStatic.publicKey,
		hostStatic.publicKey,
		deviceEphemeral.publicKey,
		hostEphemeral.publicKey,
		deviceNonce,
		hostNonce
	);
	const okm = Buffer.from(hkdfSync('sha256', ikm, salt, utf8('harness-remote/v1/keys'), 64));
	const keys = { d2h: okm.subarray(0, 32), h2d: okm.subarray(32, 64) };
	const plain = [
		{ direction: 'd2h', counter: 0, more: false, plaintext: '{"type":"request"}' },
		{ direction: 'h2d', counter: 0, more: true, plaintext: 'first chunk ' },
		{ direction: 'h2d', counter: 1, more: false, plaintext: 'second chunk é' }
	] as const;
	const packets = plain.map((packet) => ({
		...packet,
		data: seal(
			keys[packet.direction],
			counterNonce(packet.counter),
			`harness-remote/v1/${packet.direction}/${packet.counter}/${packet.more ? '1' : '0'}`,
			packet.plaintext
		)
	}));
	return { d2h: hex(keys.d2h), h2d: hex(keys.h2d), packets };
}
function pairing() {
	const pairingId = '0f'.repeat(16);
	const ikm = pairingEphemeral.ecdh.computeSecret(hostStatic.publicKey);
	const salt = sha(
		utf8(`harness-remote/v1/pairing\n${hostId}\n${pairingId}\n`),
		pairingEphemeral.publicKey,
		hostStatic.publicKey
	);
	const okm = Buffer.from(
		hkdfSync('sha256', ikm, salt, utf8('harness-remote/v1/pairing-keys'), 64)
	);
	const requestPlain = JSON.stringify({
		code: 'ABCDEFGH',
		deviceKey: b64(deviceStatic.publicKey),
		deviceName: 'Fixture phone',
		platform: 'test',
		challenge: b64(sha(utf8('fixture-verifier')))
	});
	const approvalPlain = JSON.stringify({
		deviceId,
		hostName: 'Fixture Mac',
		generation,
		grant: { projects: [], agents: false }
	});
	const zero = Buffer.alloc(12);
	return {
		pairingId,
		ephemeral: pairingEphemeral.stored,
		requestPlain,
		requestSealed: seal(
			okm.subarray(0, 32),
			zero,
			'harness-remote/v1/pairing-request',
			requestPlain
		),
		approvalPlain,
		approvalSealed: seal(
			okm.subarray(32, 64),
			zero,
			'harness-remote/v1/pairing-approval',
			approvalPlain
		)
	};
}
const credential = b64(run(0xc0, 32));
const vectors = {
	schemaVersion: 1,
	hostStatic: hostStatic.stored,
	deviceStatic: deviceStatic.stored,
	hostEphemeral: hostEphemeral.stored,
	deviceEphemeral: deviceEphemeral.stored,
	hostId,
	deviceId,
	generation,
	deviceNonce: b64(deviceNonce),
	hostNonce: b64(hostNonce),
	session: session(),
	pairing: pairing(),
	credential: {
		credential,
		hostHash: hex(sha(utf8(`harness-remote/v1/credential\nhost\n${hostId}\n\n${credential}`))),
		deviceHash: hex(
			sha(utf8(`harness-remote/v1/credential\ndevice\n${hostId}\n${deviceId}\n${credential}`))
		)
	}
};
mkdirSync('test/support', { recursive: true });
writeFileSync('test/support/secure-vectors.json', JSON.stringify(vectors, null, '\t') + '\n');
