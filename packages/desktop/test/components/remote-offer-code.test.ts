import { afterEach, expect, test, vi } from 'vitest';
import RemoteOfferCode from '../../src/components/remote-offer-code/RemoteOfferCode.svelte';
import type { RemoteHost } from '../../src/lib/stores/remoteHost.svelte';
import { drawn } from '../evidence-fixture';
import { decoded, offerVectors } from '../qr-fixture';

/** The QR code of an open offer as the computer draws it. Every value here is synthetic. */
const offer = {
	pairingId: 'b'.repeat(32),
	hostId: 'a'.repeat(40),
	origin: 'https://relay.example.invalid',
	code: 'KQ7M-2XWP',
	scan: offerVectors.valid.text,
	expiresAt: '2026-10-13T12:04:00.000Z'
};
const store = { busy: false } as RemoteHost;
const at = (time: number) => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(time);
	return drawn(RemoteOfferCode, { offer, store });
};
afterEach(() => vi.useRealTimers());

test('an open offer is drawn as a QR code with the time it has left and ways to renew or withdraw it', () => {
	const body = at(offerVectors.now);
	expect(body).toContain('role="img"');
	expect(body).toContain('aria-label="Pairing QR code"');
	expect(body).toContain('Expires in 4:00');
	expect(body).toMatch(/<button[^>]*>New code<\/button>/);
	expect(body).toMatch(/<button[^>]*>Hide code<\/button>/);
	expect(body).toContain('Scan this code with Harness on your phone');
	expect(at(offerVectors.now + 175_000)).toContain('Expires in 1:05');
});

test('the drawn symbol is the offer, and the offer is written nowhere else on the page', () => {
	const body = at(offerVectors.now);
	const box = /viewBox="0 0 (\d+) (\d+)"/.exec(body);
	const path = / d="([^"]+)"/.exec(body)?.[1] ?? '';
	expect(box?.[1]).toBe(box?.[2]);
	const symbol = { size: Number(box?.[1]) - 8, quiet: 4, path };
	expect(decoded(symbol)).toBe(offer.scan);
	const text = body.replace(/<[^>]*>/g, ' ');
	for (const hidden of [offer.scan, 'KQ7M', offer.pairingId, 'harness-pair'])
		expect(text).not.toContain(hidden);
});

test('an offer whose time has passed is not drawn: only a new code is offered', () => {
	const body = at(Date.parse(offer.expiresAt));
	expect(body).not.toContain('<svg');
	expect(body).not.toContain('Hide code');
	expect(body).toContain('This code has expired.');
	expect(body).toMatch(/<button[^>]*>New code<\/button>/);
});
