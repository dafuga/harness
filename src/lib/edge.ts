/**
 * The runtime contract for platforms without a file system or child processes, such as
 * Cloudflare Workers: a handler in the same isolate, a precompiled core Wasm module, or a unit
 * served over HTTP. Nothing reachable from here imports a Node or Bun module.
 *
 * A native process target is not offered here; it belongs to the Bun and Node entry.
 */
export { defaultRuntimeTimeoutMs, runtimeFailure } from '../core/execution-runtimes/runtimeTypes';
export type {
	RuntimeFailure,
	RuntimeHandler,
	RuntimeOptions,
	RuntimeRequest,
	RuntimeResponse,
	TransportFailure,
	UnitRuntime
} from '../core/execution-runtimes/runtimeTypes';
export { HandlerRuntimeAdapter } from '../../packages/reports/src/components/explorer-ui/harness-compare/HandlerRuntimeAdapter';
export { HttpRuntimeAdapter } from '../adapters/execution-runtimes/HttpRuntimeAdapter';
export { WasmModuleRuntimeAdapter } from '../adapters/execution-runtimes/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export type {
	WasmLoader,
	WasmSource
} from '../adapters/execution-runtimes/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export { runtimeFetch } from '../utils/execution-runtimes/runtimeFetch';
export { runtimeReply } from '../utils/execution-runtimes/runtimeReply';
export type { RuntimeReply } from '../utils/execution-runtimes/runtimeReply';
export { runtimeResponse, runtimeResponseText } from '../utils/execution-runtimes/runtimeResponse';
