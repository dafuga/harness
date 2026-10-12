import { expect, test } from 'vitest';
import { linkFields, localOrigin, redacted } from '../scripts/ios-acceptance-guards';
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

test('the fields taken from a pairing link are its three public ones, never a code', () => {
	const link = 'harnessremote://pair?origin=http%3A%2F%2F127.0.0.1%3A8891&host=h1&pairing=p1';
	expect(linkFields(link)).toEqual({
		origin: 'http://127.0.0.1:8891',
		hostId: 'h1',
		pairingId: 'p1'
	});
	expect(Object.keys(linkFields(`${link}&code=ABCDEFGH`))).toEqual([
		'origin',
		'hostId',
		'pairingId'
	]);
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
