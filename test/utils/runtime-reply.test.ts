import { expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../../src/adapters/HandlerRuntimeAdapter';
import { runtimeReply } from '../../src/utils/runtimeReply';

let calls = 0;
const runtime = new HandlerRuntimeAdapter((request) => {
	calls += 1;
	return { ok: true, output: request.operation };
});
const text = (value: string) => () => Promise.resolve(value);

test('one JSON request per POST reaches the unit', async () => {
	expect(await runtimeReply(runtime, 'POST', text('{"operation":"version"}'))).toEqual({
		status: 200,
		value: { ok: true, output: 'version' }
	});
});

test('anything else is refused before the unit runs', async () => {
	calls = 0;
	expect(await runtimeReply(runtime, 'GET', text(''))).toEqual({
		status: 405,
		value: {
			ok: false,
			error: { code: 'invalid-request', message: 'send one JSON request per POST' }
		}
	});
	expect(await runtimeReply(runtime, 'POST', text('{not json'))).toMatchObject({
		status: 400,
		value: { error: { code: 'invalid-json' } }
	});
	expect(await runtimeReply(runtime, 'POST', text('{"operation":1e999}'))).toMatchObject({
		status: 400,
		value: { ok: false }
	});
	expect(calls).toBe(0);
});
