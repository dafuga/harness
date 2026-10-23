import type { RuntimeKind } from '../../../core/development-tooling/unitTypes';
import type { WasmRuntimeAdapter } from '../../../adapters/execution-runtimes/wasm-runtime-adapter/WasmRuntimeAdapter';
import type { ProcessRuntimeAdapter } from '../../../adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
import type { RuntimeChoice } from '../../../utils/execution-runtimes/chooseRuntime';

export interface ParityReport {
	contract: string;
	cases: number;
	status: 'passed' | 'failed' | 'incomplete';
	runtimes: Array<{ runtime: RuntimeKind; available: boolean; mismatches: number }>;
}

export interface ParityCases {
	requests: unknown[];
	texts: string[];
}

export type ByteRuntime = WasmRuntimeAdapter | ProcessRuntimeAdapter;

export interface DefaultReport extends RuntimeChoice {
	/** Where the measurements behind the choice came from; null when there are none. */
	evidence: { kind: 'calibration'; verified: false; commit: string | null; dirty: boolean } | null;
}
