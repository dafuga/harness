import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeConnectionService } from '../../src/lib/development-tooling/desktop-initialization/NativeConnectionService';
import type { NativeConnectionOptions } from '../../src/lib/development-tooling/desktop-initialization/NativeConnectionService.types';

test('Returns empty connection when origin is missing', () => {
	const options = {
		file: '/unused/session.json',
		cache: undefined,
		open: async () => undefined
	} as unknown as NativeConnectionOptions;
	const encryption = {
		isEncryptionAvailable: () => false,
		encryptString: (value: string) => Buffer.from(value),
		decryptString: (value: Buffer) => value.toString()
	};
	const output = new NativeConnectionService().create(options, encryption);
	expect(output).toEqual({});
	recordExampleCases(
		{
			unitId: 'desktop.service.native-connection',
			symbol: 'create',
			state: 'returns-empty-connection-when-origin-is-missing',
			evidence: 'examples-cases',
			file: 'returns-empty-connection-when-origin-is-missing.json'
		},
		[
			{
				name: 'Missing origin returns an empty connection without using other options',
				input: { options: { origin: undefined }, encryptionAvailable: false },
				output
			}
		]
	);
});
