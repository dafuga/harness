import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	wasmUnavailable,
	WasmModuleRuntimeAdapter
} from '../../src/adapters/execution-runtimes/wasm-runtime-adapter/WasmModuleRuntimeAdapter';

test('invoke rejects non portable JSON before loading the module', async () => {
	const adapter = new WasmModuleRuntimeAdapter(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
	const request = { operation: 'run', input: { value: Number.NaN } };
	const output = await adapter.invoke(request);
	expect(output).toEqual({
		ok: false,
		error: { code: 'invalid-json', message: 'request is not valid JSON' }
	});
	recordExampleCases(
		{
			unitId: 'adapter.wasm-module-runtime',
			symbol: 'WasmModuleRuntimeAdapter.invoke',
			state: 'invoke-rejects-non-portable-json-before-loading-the-module',
			evidence: 'examples-cases',
			file: 'invoke-rejects-non-portable-json-before-loading-the-module.json'
		},
		[{ name: 'non-finite input is rejected as invalid JSON', input: request, output }]
	);
});

test('wasmUnavailable names the supplied load failure', () => {
	const error = wasmUnavailable('missing ABI exports');
	expect(error).toMatchObject({ name: 'RuntimeUnavailable', message: 'missing ABI exports' });
	recordExampleCases(
		{
			unitId: 'adapter.wasm-module-runtime',
			symbol: 'wasmUnavailable',
			state: 'wasmunavailable-names-the-supplied-load-failure',
			evidence: 'examples-cases',
			file: 'wasmunavailable-names-the-supplied-load-failure.json'
		},
		[
			{
				name: 'missing ABI error preserves its message and runtime name',
				input: 'missing ABI exports',
				output: { name: error.name, message: error.message }
			}
		]
	);
});
