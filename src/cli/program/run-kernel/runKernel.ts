import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { ProcessRuntimeAdapter } from '../../../adapters/process-runtime-adapter/ProcessRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../../adapters/wasm-runtime-adapter/WasmRuntimeAdapter';
import { representativeWorkload } from '../../../core/benchmarkTypes';
import { fail } from '../../../core/errors';
import { kernelContract } from '../../../core/kernelTypes';
import type { RuntimeRequest } from '../../../core/runtimeTypes';
import { runtimeKinds, type RuntimeKind } from '../../../core/unitTypes';
import { MeasurementRepository } from '../../../repositories/MeasurementRepository';
import { RuntimeServerService, type ServedRuntime } from './RuntimeServerService';
import { UnitRuntimeService } from '../../../services/UnitRuntimeService';
import { timeCall } from '../../../utils/benchSamples';
import { chooseRuntime, type RuntimeChoice } from '../../../utils/chooseRuntime';
import { impactKernel } from '../../../utils/impact-kernel/impactKernel';
import { impactKernelText } from './impactKernel';
import { kernelArtifacts } from '../../../utils/kernelArtifacts';
import { kernelMutations, kernelTexts } from './kernelWorkload';
import { kernelWorkload } from '../../../utils/kernelWorkload';
import { runtimeResponseText } from '../../../utils/runtimeResponse';
import { machineProfile } from '../../../utils/machineProfile';

export interface ParityReport {
	contract: string;
	cases: number;
	status: 'passed' | 'failed' | 'incomplete';
	runtimes: Array<{ runtime: RuntimeKind; available: boolean; mismatches: number }>;
}

const paritySizes = [0, 1, 2, 3, 17, 120, 900];

interface ParityCases {
	requests: unknown[];
	texts: string[];
}

type ByteRuntime = WasmRuntimeAdapter | ProcessRuntimeAdapter;

function parityCases(): ParityCases {
	const seeded = paritySizes.flatMap((nodes) =>
		Array.from({ length: 10 }, (_, seed) => kernelWorkload(nodes, seed + 1))
	);
	const malformed = kernelMutations(kernelWorkload(30, 21), 60);
	return { requests: [...seeded, ...malformed, { operation: 'version' }], texts: kernelTexts() };
}

/** Compares the built Wasm and native kernels with the TypeScript reference, case by case. */
export async function kernelParity(): Promise<ParityReport> {
	const artifacts = kernelArtifacts();
	const cases = parityCases();
	const wasm = artifacts.wasm ? new WasmRuntimeAdapter(artifacts.wasm) : undefined;
	const native = artifacts.native ? persistent(artifacts.native) : undefined;
	const runtimes = [await compare('wasm', wasm, cases), await compare('process', native, cases)];
	const total = cases.requests.length + cases.texts.length;
	return { contract: kernelContract, cases: total, status: parityStatus(runtimes), runtimes };
}

/** Structured requests go through the adapter; raw texts go straight to the byte transport. */
async function compare(
	runtime: RuntimeKind,
	adapter: ByteRuntime | undefined,
	cases: ParityCases
): Promise<ParityReport['runtimes'][number]> {
	if (!adapter) return { runtime, available: false, mismatches: 0 };
	let mismatches = 0;
	for (const request of cases.requests) {
		const actual = await adapter.invoke(request as RuntimeRequest);
		if (!isDeepStrictEqual(actual, impactKernel(request))) mismatches += 1;
	}
	for (const text of cases.texts) {
		const actual = runtimeResponseText(await adapter.invokeText(text));
		if (!isDeepStrictEqual(actual, runtimeResponseText(impactKernelText(text)))) mismatches += 1;
	}
	await adapter.close();
	return { runtime, available: true, mismatches };
}

function parityStatus(runtimes: ParityReport['runtimes']): ParityReport['status'] {
	if (runtimes.some((item) => item.mismatches > 0)) return 'failed';
	return runtimes.some((item) => !item.available) ? 'incomplete' : 'passed';
}

function persistent(command: string): ProcessRuntimeAdapter {
	return new ProcessRuntimeAdapter({ command, args: ['--lines'], persistent: true });
}

export function parityProblems(report: ParityReport): string[] {
	return report.runtimes.flatMap((item) => {
		if (!item.available) return [`${item.runtime} runtime is not built; run bun run build:kernel`];
		return item.mismatches > 0
			? [`${item.runtime} runtime disagrees with the reference in ${item.mismatches} cases`]
			: [];
	});
}

export interface DefaultReport extends RuntimeChoice {
	/** Where the measurements behind the choice came from; null when there are none. */
	evidence: { kind: 'calibration'; verified: false; commit: string | null; dirty: boolean } | null;
}

/** The default for this machine, or the default a measurement file supports. */
export function kernelDefault(measurements?: string): DefaultReport {
	const repository = new MeasurementRepository(process.cwd());
	const profile = machineProfile().id;
	const recorded = measurements ? repository.read(measurements) : repository.forProfile(profile);
	const choice = chooseRuntime({
		measurements: recorded?.measurements ?? [],
		workload: representativeWorkload,
		profile: recorded?.profile.id ?? profile
	});
	const evidence = recorded
		? { kind: 'calibration' as const, verified: false as const, ...recorded.source }
		: null;
	return { ...choice, evidence };
}

export function renderDefault(report: DefaultReport): string {
	const tree = report.evidence?.dirty ? 'an uncommitted tree' : 'a clean tree';
	const basis = report.evidence
		? `${report.basis}; calibration from ${tree}, not verified`
		: `${report.basis}; no measurement for this machine profile`;
	return `Default runtime: ${report.runtime} (${basis}). ${report.rule}`;
}

export function runtimeKind(value: string): RuntimeKind {
	const kind = runtimeKinds.find((item) => item === value);
	return kind ?? fail(`Unknown runtime "${value}". Use one of: ${runtimeKinds.join(', ')}.`);
}

export function serveKernelRuntime(runtime: string, port: number): Promise<ServedRuntime> {
	const kernel = new UnitRuntimeService().kernel(runtimeKind(runtime));
	return new RuntimeServerService().serve(kernel, { port });
}

/** One cold call: build the runtime, invoke once, and report the elapsed time. */
export async function kernelSample(options: {
	runtime: string;
	nodes: number;
	seed: number;
	url?: string;
}): Promise<{ elapsedMs: number }> {
	const request = kernelWorkload(options.nodes, options.seed);
	const env = { ...process.env, HARNESS_KERNEL_URL: options.url };
	const started = performance.now();
	const runtime = new UnitRuntimeService(process.cwd(), { env }).kernel(
		runtimeKind(options.runtime)
	);
	await timeCall(runtime, request);
	const elapsedMs = performance.now() - started;
	await runtime.close();
	return { elapsedMs };
}
