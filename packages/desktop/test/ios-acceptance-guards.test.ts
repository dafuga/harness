import { expect, test } from 'vitest';
import {
	expiredOffer,
	localOrigin,
	otherVersion,
	redacted,
	scanArgument
} from '../scripts/ios-acceptance-guards';
import { readPairingOffer } from '../../remote/src/index';
import { AcceptanceRecord } from '../scripts/ios-acceptance-record';

test('the run talks only to plain http on this machine, by number and with a port', () => {
	expect(localOrigin('http://127.0.0.1:8892')).toBe(true);
	for (const origin of [
		'https://127.0.0.1:8892',
		'http://localhost:8892',
		'http://127.0.0.1',
		'http://127.0.0.1:8892/status',
		'http://127.0.0.1.example.org:8892',
		'http://user@127.0.0.1:8892',
		'http://192.168.1.20:8892',
		'https://relay.example.org'
	])
		expect(localOrigin(origin)).toBe(false);
});

test('a one-time code is hidden with and without its separators, wherever it appears', () => {
	const hidden = redacted('typed ABCD-EFGH, sent ABCDEFGH, kept abcd', ['ABCD-EFGH']);
	expect(hidden).toBe('typed [hidden], sent [hidden], kept abcd');
	expect(redacted('nothing to hide', [])).toBe('nothing to hide');
	expect(redacted('a short one stays: ab', ['ab'])).toBe('a short one stays: ab');
});

test('the offers a run makes wrong are the same offer, refused for exactly the named reason', () => {
	const now = Date.parse('2026-10-13T12:00:00.000Z');
	const fields = `host=${'a'.repeat(40)};pairing=${'b'.repeat(32)};code=KQ7M2XWP`;
	const scan = `harness-pair:v1;aud=harness-phone;env=local;exp=1791893040;${fields};origin=http://127.0.0.1:8891`;
	const read = (text: string) => readPairingOffer(text, { now, environments: ['local'] });
	expect(read(scan)).toHaveProperty('offer');
	expect(read(expiredOffer(scan, now))).toEqual({ refused: 'expired' });
	expect(read(otherVersion(scan))).toEqual({ refused: 'unsupported' });
	expect(expiredOffer(scan, now).replace(/exp=\d+/, '')).toBe(scan.replace(/exp=\d+/, ''));
	expect(scanArgument).toBe('-HarnessSyntheticScans');
});

test('the record counts every assertion and never prints or keeps a code it was told', () => {
	const printed: string[] = [];
	const record = new AcceptanceRecord((line) => printed.push(line));
	record.begin('Pairing');
	record.hide('WXYZ-2345');
	record.check(true, 'the code WXYZ-2345 was entered');
	record.check(0, 'nothing reached the relay');
	record.stopped(new Error('"Connected" did not appear; last seen: WXYZ2345\nstack'));
	expect([record.passed, record.failed]).toEqual([1, 2]);
	expect(record.checks.map((check) => check.phase)).toEqual(['Pairing', 'Pairing', 'Pairing']);
	const everything = JSON.stringify(record.checks) + printed.join('\n');
	expect(everything).not.toMatch(/WXYZ-?2345/);
	expect(everything).not.toContain('stack');
	expect(printed).toContain('FAIL nothing reached the relay');
});
