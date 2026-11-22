import { expect, test } from 'vitest';
import {
	VaultWireValidator,
	binary,
	vaultDecision,
	vaultTicket
} from '../../../src/validators/accounts-access/VaultWireValidator';

const wire = new VaultWireValidator();

test('binary fields accept only canonical base64url of the declared length', () => {
	const ok = Buffer.alloc(32, 7).toString('base64url');
	expect(binary(32).safeParse(ok).success).toBe(true);
	expect(binary(32).safeParse(ok + '=').success).toBe(false);
	expect(binary(32).safeParse(Buffer.alloc(31).toString('base64url')).success).toBe(false);
});

test('a refusal names the field but never echoes its value', () => {
	const secret = 'canary-password-7f3a';
	expect(() => wire.parse(vaultTicket, { requestId: secret, receipt: secret }, 'ticket')).toThrow(
		'Invalid ticket at requestId.'
	);
	try {
		wire.json(
			vaultDecision,
			Buffer.from('{"decision":"approve","x":"' + secret + '"}'),
			'decision'
		);
	} catch (error) {
		expect(String((error as Error).message)).not.toContain(secret);
		expect(error).toMatchObject({ status: 400 });
	}
	expect(() => wire.json(vaultTicket, Buffer.from([0xff]), 'ticket')).toThrow('not UTF-8 JSON');
});
