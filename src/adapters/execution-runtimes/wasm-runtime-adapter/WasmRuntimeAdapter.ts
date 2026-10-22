import { readFile } from 'node:fs/promises';
import type { RuntimeOptions } from '../../../core/execution-runtimes/runtimeTypes';
import { WasmModuleRuntimeAdapter, wasmUnavailable } from './WasmModuleRuntimeAdapter';

/** Runs a core WebAssembly unit read from a file; it implements the Harness JSON ABI. */
export class WasmRuntimeAdapter extends WasmModuleRuntimeAdapter {
	constructor(file: string, options: RuntimeOptions = {}) {
		super(
			() =>
				readFile(file).catch(() => {
					throw wasmUnavailable(`Wasm module ${file} cannot be read`);
				}),
			options
		);
	}
}
