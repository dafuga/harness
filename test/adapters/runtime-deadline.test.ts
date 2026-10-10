import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleRuntimeAdapter } from '../../src/adapters/ModuleRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../src/adapters/WasmRuntimeAdapter';
import type { RuntimeResponse } from '../../src/core/runtimeTypes';
import { UnitRuntimeService } from '../../src/services/UnitRuntimeService';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';
import { kernelWorkload } from '../../src/utils/kernelWorkload';

const completed: RuntimeResponse = { ok: true, output: 'completed' };
const timeout = (ms: number): RuntimeResponse => ({
	ok: false,
	error: { code: 'runtime-timeout', message: `no response within ${ms} ms` }
});
const wasm = kernelArtifacts().wasm ?? '';
const large = kernelWorkload(20_000, 3);

/** Occupies the thread, so no timer can fire until it returns. */
function busy(ms: number): void {
	const until = performance.now() + ms;
	while (performance.now() < until);
}

test('a synchronous module handler that overruns its deadline is a timeout, never a late success', async () => {
	const runtime = new ModuleRuntimeAdapter(
		() => {
			busy(40);
			return completed;
		},
		{ timeoutMs: 5 }
	);
	const started = performance.now();
	const response = await runtime.invoke({ operation: 'version' });
	const elapsed = performance.now() - started;

	expect(response).toEqual(timeout(5));
	// In-process work cannot be interrupted: the call still lasted as long as the handler ran.
	expect(elapsed).toBeGreaterThanOrEqual(39);
});

test('an asynchronous handler that blocks past its deadline is a timeout as well', async () => {
	const runtime = new ModuleRuntimeAdapter(
		async () => {
			await Promise.resolve();
			busy(40);
			return completed;
		},
		{ timeoutMs: 5 }
	);
	expect(await runtime.invoke({ operation: 'version' })).toEqual(timeout(5));
});

test('a handler that finishes inside its deadline still succeeds', async () => {
	const runtime = new ModuleRuntimeAdapter(
		() => {
			busy(2);
			return completed;
		},
		{ timeoutMs: 2000 }
	);
	expect(await runtime.invoke({ operation: 'version' })).toEqual(completed);
});

test('a Wasm call that overruns its deadline is a timeout, and succeeds when given room', async () => {
	expect(wasm, 'run bun run build:kernel').not.toBe('');
	expect(await new WasmRuntimeAdapter(wasm, { timeoutMs: 1 }).invoke(large)).toEqual(timeout(1));
	expect((await new WasmRuntimeAdapter(wasm, { timeoutMs: 60_000 }).invoke(large)).ok).toBe(true);
});

test('declared targets and the kernel carry the deadline to in-process runtimes', async () => {
	const strict = new UnitRuntimeService(resolve('.'), { timeoutMs: 1 });
	expect(await strict.forTarget({ kind: 'wasm', entry: wasm }).invoke(large)).toEqual(timeout(1));
	expect(await strict.kernel('wasm').invoke(large)).toEqual(timeout(1));
	expect(await strict.kernel('module').invoke(large)).toEqual(timeout(1));
	const module = {
		kind: 'module' as const,
		entry: 'src/utils/impactKernel.ts',
		handler: 'impactKernel'
	};
	expect(await strict.forTarget(module).invoke(large)).toEqual(timeout(1));
});
