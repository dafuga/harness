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
export { HttpRuntimeAdapter } from '../adapters/HttpRuntimeAdapter';
export { ModuleRuntimeAdapter } from '../adapters/ModuleRuntimeAdapter';
export { ProcessRuntimeAdapter } from '../adapters/ProcessRuntimeAdapter';
export type { ProcessRuntimeConfig } from '../adapters/ProcessRuntimeAdapter';
export { WasmRuntimeAdapter } from '../adapters/WasmRuntimeAdapter';
export { RuntimeServerService } from '../services/RuntimeServerService';
export type { ServedRuntime, ServeOptions } from '../services/RuntimeServerService';
export { UnitRuntimeService } from '../services/UnitRuntimeService';
export type { RuntimeServiceOptions } from '../services/UnitRuntimeService';
export { impactKernel, impactKernelText } from '../utils/impactKernel';
export { kernelArtifacts } from '../utils/kernelArtifacts';
export type { KernelArtifacts, KernelBuild } from '../utils/kernelArtifacts';
export { chooseRuntime } from '../utils/chooseRuntime';
export type { RuntimeChoice, RuntimeChoiceInput } from '../utils/chooseRuntime';
export { runtimeResponse, runtimeResponseText } from '../utils/runtimeResponse';
