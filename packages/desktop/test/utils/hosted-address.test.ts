import { expect, test } from 'vitest';
import { hostedAddress } from '../../src/utils/hostedAddress';

test('only a plain approval address of a secure origin is shown', () => {
	expect(hostedAddress('https://hub.example.invalid/native/handoff-1')).toBe(
		'https://hub.example.invalid/native/handoff-1'
	);
	expect(hostedAddress('http://127.0.0.1:5798/native/abc_DEF-1')).toBe(
		'http://127.0.0.1:5798/native/abc_DEF-1'
	);
});

test('anything else is not an address to send a person to', () => {
	const refused = [
		undefined,
		'',
		'javascript:alert(1)',
		'http://hub.example.invalid/native/handoff-1',
		'https://user:secret@hub.example.invalid/native/handoff-1',
		'https://hub.example.invalid/native/handoff-1?code=ABCD-EFGH',
		'https://hub.example.invalid/native/handoff-1#verifier',
		'https://hub.example.invalid/native/a/b',
		'https://hub.example.invalid/login',
		'file:///native/handoff-1'
	];
	for (const value of refused) expect(hostedAddress(value)).toBeNull();
});
