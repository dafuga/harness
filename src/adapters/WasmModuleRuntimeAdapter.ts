import {
	defaultRuntimeTimeoutMs,
	runtimeFailure,
	type RuntimeOptions,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime
} from '../core/runtimeTypes';
import { notPortable, portableJson } from '../utils/portableJson';
import { runtimeDeadline, runtimeResponseText } from '../utils/runtimeResponse';

interface JsonAbi {
	memory: WebAssembly.Memory;
	harness_alloc(length: number): number;
	harness_free(pointer: number, length: number): void;
	harness_invoke(pointer: number, length: number): bigint;
}

/** A module the platform already compiled, or the bytes of one where compiling is allowed. */
export type WasmSource = WebAssembly.Module | BufferSource;
export type WasmLoader = () => WasmSource | Promise<WasmSource>;

const abiExports = ['memory', 'harness_alloc', 'harness_free', 'harness_invoke'];
const unavailableName = 'RuntimeUnavailable';

/** An error that means the unit could not be loaded at all, rather than that it failed. */
export function wasmUnavailable(message: string): Error {
	return Object.assign(new Error(message), { name: unavailableName });
}

function isLoader(source: WasmSource | WasmLoader): source is WasmLoader {
	return typeof source === 'function';
}

async function instantiate(source: WasmSource): Promise<WebAssembly.Instance> {
	const compiled = source instanceof WebAssembly.Module;
	return WebAssembly.instantiate(compiled ? source : await WebAssembly.compile(source), {});
}

/**
 * Runs a core WebAssembly unit that implements the Harness JSON ABI. The module is handed in,
 * so nothing here reads a file: a Worker passes the module its bundler precompiled, and a
 * platform that may compile at run time can pass bytes.
 */
export class WasmModuleRuntimeAdapter implements UnitRuntime {
	readonly kind = 'wasm' as const;
	private instance: Promise<JsonAbi> | undefined;
	private readonly source: WasmLoader;
	private readonly timeoutMs: number;

	constructor(source: WasmSource | WasmLoader, options: RuntimeOptions = {}) {
		this.source = isLoader(source) ? source : () => source;
		this.timeoutMs = options.timeoutMs ?? defaultRuntimeTimeoutMs;
	}

	/** The call runs on this thread and cannot be interrupted; a late result is rejected. */
	async invoke(request: RuntimeRequest): Promise<RuntimeResponse> {
		if (!portableJson(request)) return notPortable;
		const deadline = runtimeDeadline(this.timeoutMs);
		return deadline.settle(await Promise.race([this.call(request), deadline.expired]));
	}

	private async call(request: RuntimeRequest): Promise<RuntimeResponse> {
		try {
			return runtimeResponseText(await this.invokeText(JSON.stringify(request)));
		} catch (error) {
			this.instance = undefined;
			const message = error instanceof Error ? error.message : String(error);
			const named = error instanceof Error && error.name === unavailableName;
			const unavailable = named || error instanceof WebAssembly.CompileError;
			return runtimeFailure(unavailable ? 'runtime-unavailable' : 'runtime-failed', message);
		}
	}

	/** Sends raw request text through linear memory and returns the raw response text. */
	async invokeText(text: string): Promise<string> {
		const abi = await (this.instance ??= this.load());
		const input = new TextEncoder().encode(text);
		const pointer = abi.harness_alloc(input.length);
		new Uint8Array(abi.memory.buffer, pointer, input.length).set(input);
		const packed = abi.harness_invoke(pointer, input.length);
		abi.harness_free(pointer, input.length);
		const at = Number(packed >> 32n);
		const length = Number(packed & 0xffffffffn);
		const output = new TextDecoder().decode(new Uint8Array(abi.memory.buffer, at, length));
		abi.harness_free(at, length);
		return output;
	}

	/** Bytes of linear memory the instantiated unit currently holds. */
	async memoryBytes(): Promise<number> {
		return (await (this.instance ??= this.load())).memory.buffer.byteLength;
	}

	close(): Promise<void> {
		this.instance = undefined;
		return Promise.resolve();
	}

	private async load(): Promise<JsonAbi> {
		const instance = await instantiate(await this.source());
		const exports = instance.exports as Record<string, unknown>;
		if (abiExports.every((name) => name in exports)) return exports as unknown as JsonAbi;
		throw wasmUnavailable(
			`Wasm module does not export the Harness JSON ABI (${abiExports.join(', ')})`
		);
	}
}
