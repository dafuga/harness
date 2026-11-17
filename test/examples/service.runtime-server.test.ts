import { test } from 'vitest';
import { RuntimeServerService } from '../../src/cli/program/run-kernel/RuntimeServerService';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Propagates listener errors', async () => {
	let error: unknown;
	try {
		await new RuntimeServerService().serve(
			{
				kind: 'node',
				invoke: async () => ({ value: null }),
				close: async () => undefined
			} as never,
			{ port: -1 }
		);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	const failure = error as Error;
	recordExampleCases(
		{
			unitId: 'service.runtime-server',
			symbol: 'RuntimeServerService.serve',
			state: 'propagates-listener-errors',
			evidence: 'examples-cases',
			file: 'propagates-listener-errors.json'
		},
		[
			{
				name: 'invalid listening port rejects with the server binding error',
				input: { options: { port: -1 } },
				error: { name: failure.name, message: failure.message }
			}
		]
	);
});
