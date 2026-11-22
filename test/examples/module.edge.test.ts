import { test } from 'vitest';
import { runtimeReply } from '../../src/lib/edge';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Rejects requests that do not use POST', async () => {
	let invocations = 0;
	const runtime = {
		kind: 'module' as const,
		invoke: async (_request: { operation: string; input?: unknown }) => {
			invocations += 1;
			return { ok: true, output: null } as const;
		},
		close: async () => undefined
	};
	const reply = await runtimeReply(runtime, 'GET', async () => '{"value":1}');

	expect(reply.status).toBe(405);
	expect(invocations).toBe(0);
	recordExampleCases(
		{
			unitId: 'module.edge',
			symbol: 'runtimeReply',
			state: 'rejects-requests-that-do-not-use-post',
			evidence: 'examples-cases',
			file: 'rejects-requests-that-do-not-use-post.json'
		},
		[
			{
				name: 'GET is rejected before invoking the runtime',
				input: { method: 'GET', body: '{"value":1}' },
				output: { status: reply.status, value: reply.value, invocations }
			}
		]
	);
});
