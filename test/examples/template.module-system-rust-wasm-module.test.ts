import { test } from 'vitest';
import { rustWasmModule } from '../../src/templates/module-system/rustWasmModule';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Declares a reproducible Rust WebAssembly kernel template', () => {
	const resource = rustWasmModule.resources?.[0];
	const generatedFiles = (resource?.files ?? []).map(({ path, contents }) => ({
		path,
		lines: contents
			.split('\n')
			.filter(
				(line) =>
					line.includes('crate-type') ||
					line.includes('sum_squares') ||
					line.includes('WasmKernel') ||
					line.includes('sumSquares') ||
					line.includes('invalid work')
			)
	}));
	const output = {
		id: rustWasmModule.id,
		buildScript: rustWasmModule.setup[0].path,
		buildCommand: rustWasmModule.packageScripts?.['build:wasm'],
		generatedFiles
	};
	const cases = [
		{
			name: 'Rust kernel resource provides its crate, typed service and boundary test',
			input: { resource: 'kernel', kernelName: 'matrix-sum' },
			output
		}
	];

	expect(output.id).toBe('rust-wasm');
	expect(generatedFiles.map(({ path }) => path)).toEqual([
		'src/services/rust-wasm/{{kebabName}}/Cargo.toml',
		'src/services/rust-wasm/{{kebabName}}/src/lib.rs',
		'src/services/rust-wasm/{{PascalName}}WasmService.types.ts',
		'src/services/rust-wasm/{{PascalName}}WasmService.ts',
		'test/services/rust-wasm/{{kebabName}}.test.ts'
	]);
	recordExampleCases(
		{
			unitId: 'template.module-system-rust-wasm-module',
			symbol: 'rustWasmModule',
			state: 'declares-a-reproducible-rust-webassembly-kernel-template',
			evidence: 'examples-cases',
			file: 'declares-a-reproducible-rust-webassembly-kernel-template.json'
		},
		cases
	);
});
