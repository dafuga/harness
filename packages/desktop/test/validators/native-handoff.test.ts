import { expect, test } from 'vitest';
import { NativeHandoffValidator } from '../../src/validators/NativeHandoffValidator';
test('native approval URLs cannot carry credentials or redirect approval to another origin', () => {
	const validator = new NativeHandoffValidator(),
		origin = 'https://harness.example.invalid';
	const start = {
		handoffId: 'fixture',
		userCode: 'CODE',
		verificationUrl: origin + '/native/fixture',
		expiresAt: new Date(Date.now() + 300000).toISOString(),
		interval: 2
	};
	expect(validator.start(start, origin, Date.now()).verificationUrl).toBe(start.verificationUrl);
	for (const verificationUrl of [
		'https://another.example/native/fixture',
		start.verificationUrl + '?verifier=secret',
		'https://token@harness.example.invalid/native/fixture'
	])
		expect(() => validator.start({ ...start, verificationUrl }, origin, Date.now())).toThrow('URL');
});
