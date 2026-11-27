import { expect, test } from 'vitest';
import { localOrigin, redacted } from '../scripts/ios-acceptance-guards';
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
