import { expect, test } from 'vitest';
import {
	remoteBytes,
	toBase64,
	toBase64Url,
	toHex
} from '../src/utils/networking-security/remoteBytes';
import { canaryForms, expectNoPlaintext } from './support/plaintextCanary';

const canary = 'Ship sealed sync before Friday canary';

test('the guard catches a leak in clear text, hex, raw bytes and base64 at every alignment', () => {
	expect(() => expectNoPlaintext([`{"title":"${canary}"}`], [canary])).toThrow();
	expect(() => expectNoPlaintext([toHex(remoteBytes(canary))], [canary])).toThrow();
	expect(() => expectNoPlaintext([remoteBytes(`xx${canary}yy`)], [canary])).toThrow();
	for (const prefix of ['', 'a', 'ab', 'abc']) {
		const leaked = remoteBytes(`${prefix}{"t":"${canary}"}`);
		expect(
			() => expectNoPlaintext([toBase64(leaked)], [canary]),
			`base64 ${prefix.length}`
		).toThrow();
		expect(
			() => expectNoPlaintext([toBase64Url(leaked)], [canary]),
			`base64url ${prefix.length}`
		).toThrow();
	}
});

test('the guard passes unrelated traffic and every form is long enough to be meaningful', () => {
	expectNoPlaintext(
		['{"seq":1}', toBase64Url(crypto.getRandomValues(new Uint8Array(512)))],
		[canary]
	);
	for (const form of canaryForms(canary)) expect(form.length).toBeGreaterThanOrEqual(8);
});
