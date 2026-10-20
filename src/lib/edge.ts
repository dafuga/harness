/**
 * The runtime contract for platforms without a file system or child processes, such as
 * Cloudflare Workers: a handler in the same isolate, a precompiled core Wasm module, or a unit
 * served over HTTP. Nothing reachable from here imports a Node or Bun module.
 *
 * A native process target is not offered here; it belongs to the Bun and Node entry.
 */
export { defaultRuntimeTimeoutMs, runtimeFailure } from '../core/runtimeTypes';
export type {
	RuntimeFailure,
	RuntimeHandler,
	RuntimeOptions,
	RuntimeRequest,
	RuntimeResponse,
	TransportFailure,
	UnitRuntime
} from '../core/runtimeTypes';
export { HandlerRuntimeAdapter } from '../../packages/reports/src/components/harness/harness-compare/HandlerRuntimeAdapter';
export { HttpRuntimeAdapter } from '../adapters/HttpRuntimeAdapter';
export { WasmModuleRuntimeAdapter } from '../adapters/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export type {
	WasmLoader,
	WasmSource
} from '../adapters/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export { runtimeFetch } from '../utils/runtimeFetch';
export { runtimeReply } from '../utils/runtimeReply';
export type { RuntimeReply } from '../utils/runtimeReply';
export { runtimeResponse, runtimeResponseText } from '../utils/runtimeResponse';
