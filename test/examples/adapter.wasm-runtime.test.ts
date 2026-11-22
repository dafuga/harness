import { test } from 'vitest';
import { WasmRuntimeAdapter } from '../../src/adapters/execution-runtimes/wasm-runtime-adapter/WasmRuntimeAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('invoke reports a missing module as unavailable', async () => {
	await withTempDir('wasm-runtime-examples-', async (directory) => {
		const file = `${directory}/missing.wasm`;
		const request = { operation: 'render', input: { path: 'src/index.ts' } };
		const output = await new WasmRuntimeAdapter(file).invoke(request);
		expect(output).toEqual({
			ok: false,
			error: { code: 'runtime-unavailable', message: `Wasm module ${file} cannot be read` }
		});
		recordExampleCases(
			{
				unitId: 'adapter.wasm-runtime',
				symbol: 'WasmRuntimeAdapter.invoke',
				state: 'invoke-reports-a-missing-module-as-unavailable',
				evidence: 'examples-cases',
				file: 'invoke-reports-a-missing-module-as-unavailable.json'
			},
			[
				{
					name: 'render request reports a missing module file as unavailable',
					input: { file: 'missing.wasm', request },
					output
				}
			]
		);
	});
}, 20_000);
