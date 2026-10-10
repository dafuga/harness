import { readFile } from 'node:fs/promises';
import { beforeAll, expect, test } from 'vitest';
import { WasmModuleRuntimeAdapter } from '../../src/adapters/WasmModuleRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../src/adapters/WasmRuntimeAdapter';
import { kernelArtifacts } from '../../src/utils/kernelArtifacts';

let file: string;
let bytes: Uint8Array<ArrayBuffer>;
const request = { operation: 'version' };
beforeAll(async () => {
	file = kernelArtifacts().wasm ?? '';
	bytes = new Uint8Array(await readFile(file));
});

test('a precompiled module, its bytes and a loader all run the same unit as the file adapter', async () => {
	const expected = await new WasmRuntimeAdapter(file).invoke(request);
	expect(expected.ok).toBe(true);
	const precompiled = new WasmModuleRuntimeAdapter(new WebAssembly.Module(bytes));
	expect(precompiled.kind).toBe('wasm');
	expect(await precompiled.invoke(request)).toEqual(expected);
	expect(await new WasmModuleRuntimeAdapter(bytes).invoke(request)).toEqual(expected);
	const loaded = new WasmModuleRuntimeAdapter(() => Promise.resolve(new WebAssembly.Module(bytes)));
	expect(await loaded.invoke(request)).toEqual(expected);
	expect(await loaded.memoryBytes()).toBeGreaterThan(0);
	await loaded.close();
});

test('a module without the JSON ABI, or bytes that are not Wasm, are unavailable', async () => {
	const empty = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
	expect(await new WasmModuleRuntimeAdapter(new WebAssembly.Module(empty)).invoke(request)).toEqual(
		{
			ok: false,
			error: {
				code: 'runtime-unavailable',
				message:
					'Wasm module does not export the Harness JSON ABI (memory, harness_alloc, harness_free, harness_invoke)'
			}
		}
	);
	const garbage = await new WasmModuleRuntimeAdapter(new Uint8Array([1, 2, 3])).invoke(request);
	expect(garbage).toMatchObject({ ok: false, error: { code: 'runtime-unavailable' } });
	const refused = new WasmModuleRuntimeAdapter(() => Promise.reject(new Error('no module here')));
	expect(await refused.invoke(request)).toEqual({
		ok: false,
		error: { code: 'runtime-failed', message: 'no module here' }
	});
});

test('the file adapter still reports an unreadable file as unavailable', async () => {
	const missing = new WasmRuntimeAdapter('/nonexistent/unit.wasm');
	expect(missing).toBeInstanceOf(WasmModuleRuntimeAdapter);
	expect(await missing.invoke(request)).toEqual({
		ok: false,
		error: {
			code: 'runtime-unavailable',
			message: 'Wasm module /nonexistent/unit.wasm cannot be read'
		}
	});
});
