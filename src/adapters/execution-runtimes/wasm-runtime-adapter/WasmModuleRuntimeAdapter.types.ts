export interface JsonAbi {
	memory: WebAssembly.Memory;
	harness_alloc(length: number): number;
	harness_free(pointer: number, length: number): void;
	harness_invoke(pointer: number, length: number): bigint;
}

/** A module the platform already compiled, or the bytes of one where compiling is allowed. */
export type WasmSource = WebAssembly.Module | BufferSource;

export type WasmLoader = () => WasmSource | Promise<WasmSource>;
