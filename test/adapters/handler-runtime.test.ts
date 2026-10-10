import { expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../../src/adapters/HandlerRuntimeAdapter';
import { ModuleRuntimeAdapter } from '../../src/adapters/ModuleRuntimeAdapter';
import type { RuntimeHandler } from '../../src/core/runtimeTypes';

const echo: RuntimeHandler = (request) => ({ ok: true, output: request.input });

test('a handler answers through the runtime contract', async () => {
	const runtime = new HandlerRuntimeAdapter(echo);
	expect(runtime.kind).toBe('module');
	expect(await runtime.invoke({ operation: 'echo', input: { size: 3 } })).toEqual({
		ok: true,
		output: { size: 3 }
	});
	await runtime.close();
});

test('whatever the handler does wrong becomes a failure with a stable code', async () => {
	const thrown = new HandlerRuntimeAdapter(() => {
		throw new Error('broke');
	});
	expect(await thrown.invoke({ operation: 'x' })).toEqual({
		ok: false,
		error: { code: 'runtime-failed', message: 'broke' }
	});
	const shapeless = new HandlerRuntimeAdapter(() => 'done' as never);
	expect(await shapeless.invoke({ operation: 'x' })).toMatchObject({
		error: { code: 'invalid-response' }
	});
	const late = new HandlerRuntimeAdapter(
		() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, output: 1 }), 60)),
		{ timeoutMs: 10 }
	);
	expect(await late.invoke({ operation: 'x' })).toMatchObject({
		error: { code: 'runtime-timeout' }
	});
	const circular: Record<string, unknown> = {};
	circular.self = circular;
	expect(await new HandlerRuntimeAdapter(echo).invoke({ operation: 'x', input: circular })).toEqual(
		await new ModuleRuntimeAdapter(echo).invoke({ operation: 'x', input: circular })
	);
});

test('the Node module adapter is the same runtime with file loading added', async () => {
	const node = new ModuleRuntimeAdapter(echo);
	expect(node).toBeInstanceOf(HandlerRuntimeAdapter);
	const request = { operation: 'echo', input: ['a', 1, null] };
	expect(await node.invoke(request)).toEqual(await new HandlerRuntimeAdapter(echo).invoke(request));
});
