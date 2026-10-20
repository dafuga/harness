/**
 * Public runtime contract of Harness: one typed request and response, carried by a module,
 * a core Wasm module, a native JSON process or an HTTP service.
 *
 * Importing this module has no side effects; adapters do nothing until they are invoked.
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
export type { ExecutionTarget, RuntimeKind } from '../core/unitTypes';
export { kernelContract } from '../core/kernelTypes';
export type { AffectedNode, ImpactInput, ImpactOutput, KernelGraph } from '../core/kernelTypes';
export { HandlerRuntimeAdapter } from '../../packages/reports/src/components/harness/harness-compare/HandlerRuntimeAdapter';
export { HttpRuntimeAdapter } from '../adapters/HttpRuntimeAdapter';
export { ModuleRuntimeAdapter } from '../adapters/ModuleRuntimeAdapter';
export { ProcessRuntimeAdapter } from '../adapters/process-runtime-adapter/ProcessRuntimeAdapter';
export { type ProcessRuntimeConfig } from '../adapters/process-runtime-adapter/ProcessRuntimeAdapter';
export { WasmModuleRuntimeAdapter } from '../adapters/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export type {
	WasmLoader,
	WasmSource
} from '../adapters/wasm-runtime-adapter/WasmModuleRuntimeAdapter';
export { WasmRuntimeAdapter } from '../adapters/wasm-runtime-adapter/WasmRuntimeAdapter';
export { RuntimeServerService } from '../cli/program/run-kernel/RuntimeServerService';
export type { ServedRuntime, ServeOptions } from '../cli/program/run-kernel/RuntimeServerService';
export { UnitRuntimeService } from '../services/UnitRuntimeService';
export type { RuntimeServiceOptions } from '../services/UnitRuntimeService';
export { impactKernel } from '../utils/impact-kernel/impactKernel';
export { impactKernelText } from '../cli/program/run-kernel/impactKernel';
export { kernelArtifacts } from '../utils/kernelArtifacts';
export type { KernelArtifacts, KernelBuild } from '../utils/kernelArtifacts';
export { chooseRuntime } from '../utils/chooseRuntime';
export type { RuntimeChoice, RuntimeChoiceInput } from '../utils/chooseRuntime';
export { runtimeFetch } from '../utils/runtimeFetch';
export { runtimeReply } from '../utils/runtimeReply';
export type { RuntimeReply } from '../utils/runtimeReply';
export { runtimeResponse, runtimeResponseText } from '../utils/runtimeResponse';
