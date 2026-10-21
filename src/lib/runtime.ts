/**
 * Public runtime contract of Harness: one typed request and response, carried by a module,
 * a core Wasm module, a native JSON process or an HTTP service.
 *
 * Importing this module has no side effects; adapters do nothing until they are invoked.
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
export type { ExecutionTarget, RuntimeKind } from '../core/development-tooling/unitTypes';
export { kernelContract } from '../core/execution-runtimes/kernelTypes';
export type {
	AffectedNode,
	ImpactInput,
	ImpactOutput,
	KernelGraph
} from '../core/execution-runtimes/kernelTypes';
export { HandlerRuntimeAdapter } from '../../packages/reports/src/components/harness/harness-compare/HandlerRuntimeAdapter';
export { HttpRuntimeAdapter } from '../adapters/execution-runtimes/HttpRuntimeAdapter';
export { ModuleRuntimeAdapter } from '../adapters/execution-runtimes/ModuleRuntimeAdapter';
export { ProcessRuntimeAdapter } from '../adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
export { type ProcessRuntimeConfig } from '../adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
export { WasmModuleRuntimeAdapter } from '../adapters/execution-runtimes/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export type {
	WasmLoader,
	WasmSource
} from '../adapters/execution-runtimes/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export { WasmRuntimeAdapter } from '../adapters/execution-runtimes/wasm-runtime-adapter/WasmRuntimeAdapter';
export { RuntimeServerService } from '../cli/program/run-kernel/RuntimeServerService';
export type { ServedRuntime, ServeOptions } from '../cli/program/run-kernel/RuntimeServerService';
export { UnitRuntimeService } from '../services/execution-runtimes/UnitRuntimeService';
export type { RuntimeServiceOptions } from '../services/execution-runtimes/UnitRuntimeService';
export { impactKernel } from '../utils/execution-runtimes/impact-kernel/impactKernel';
export { impactKernelText } from '../cli/program/run-kernel/impactKernel';
export { kernelArtifacts } from '../utils/execution-runtimes/kernelArtifacts';
export type { KernelArtifacts, KernelBuild } from '../utils/execution-runtimes/kernelArtifacts';
export { chooseRuntime } from '../utils/execution-runtimes/chooseRuntime';
export type { RuntimeChoice, RuntimeChoiceInput } from '../utils/execution-runtimes/chooseRuntime';
export { runtimeFetch } from '../utils/execution-runtimes/runtimeFetch';
export { runtimeReply } from '../utils/execution-runtimes/runtimeReply';
export type { RuntimeReply } from '../utils/execution-runtimes/runtimeReply';
export { runtimeResponse, runtimeResponseText } from '../utils/execution-runtimes/runtimeResponse';
