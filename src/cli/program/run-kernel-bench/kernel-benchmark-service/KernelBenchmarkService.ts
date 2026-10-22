import { spawn, spawnSync } from 'node:child_process';
import { HttpRuntimeAdapter } from '../../../../adapters/execution-runtimes/HttpRuntimeAdapter';
import { ProcessRuntimeAdapter } from '../../../../adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
import { WasmRuntimeAdapter } from '../../../../adapters/execution-runtimes/wasm-runtime-adapter/WasmRuntimeAdapter';
import type {
	BenchMeasurement,
	KernelBenchmark
} from '../../../../core/development-tooling/benchmarkTypes';
import { fail } from '../../../../core/development-tooling/errors';
import type { RuntimeRequest, UnitRuntime } from '../../../../core/execution-runtimes/runtimeTypes';
import type { RuntimeKind } from '../../../../core/development-tooling/unitTypes';
import {
	benchMeasurement,
	type MeasureContext
} from '../../../../utils/verification-evidence/benchMeasurement';
import { benchSamples } from './benchSamples';
import { median } from '../../../../utils/development-tooling/benchSamples';
import { impactKernel } from '../../../../utils/execution-runtimes/impact-kernel/impactKernel';
import {
	kernelArtifacts,
	type Environment,
	type KernelArtifacts
} from '../../../../utils/execution-runtimes/kernelArtifacts';
import { peakMemory } from './peakMemory';
import { UnitRuntimeService } from '../../../../services/execution-runtimes/UnitRuntimeService';

export interface BenchPlan {
	/** Command line that starts this CLI, used for fresh-process samples and the HTTP server. */
	cli: string[];
	coldSamples: number;
	warmIterations: number;
}

export interface WorkloadRun {
	id: string;
	nodes: number;
	seed: number;
	request: RuntimeRequest;
}

type Workload = KernelBenchmark['workloads'][number];

const runtimes: RuntimeKind[] = ['module', 'wasm', 'process', 'http'];

function coldMethod(samples: number): string {
	return (
		`Median of ${samples} fresh-process samples: create the runtime, serialize the request, ` +
		'invoke once and parse the response. CLI startup is excluded because every runtime pays it.'
	);
}

function warmMethod(iterations: number): string {
	return (
		`Median of ${iterations} calls on an initialized runtime, including request serialization ` +
		'and response parsing.'
	);
}

/** Measures every runtime on identical workloads, end to end. */
export class KernelBenchmarkService {
	private readonly artifacts: KernelArtifacts = kernelArtifacts();

	constructor(
		private readonly plan: BenchPlan,
		private readonly context: MeasureContext
	) {}

	async measure(run: WorkloadRun, url: string): Promise<BenchMeasurement[]> {
		const results: BenchMeasurement[] = [];
		for (const target of runtimes) {
			const runtime = this.warmRuntime(target, url);
			try {
				results.push(...(await this.latency(target, run, { runtime, url })));
				results.push(await this.memory(target, run, runtime));
			} finally {
				await runtime.close();
			}
		}
		return results;
	}

	describe(run: WorkloadRun): Workload {
		const input = run.request.input as { base: { edges: unknown[] }; changed: unknown[] };
		return {
			id: run.id,
			nodes: run.nodes,
			edges: input.base.edges.length,
			changed: input.changed.length,
			requestBytes: Buffer.byteLength(JSON.stringify(run.request)),
			responseBytes: Buffer.byteLength(JSON.stringify(impactKernel(run.request)))
		};
	}

	private warmRuntime(target: RuntimeKind, url: string): UnitRuntime {
		const native = this.artifacts.native ?? fail('Build the kernel first: bun run build:kernel.');
		if (target === 'process') {
			return new ProcessRuntimeAdapter({ command: native, args: ['--lines'], persistent: true });
		}
		if (target === 'http') return new HttpRuntimeAdapter(url);
		return new UnitRuntimeService().kernel(target);
	}

	private async latency(
		target: RuntimeKind,
		run: WorkloadRun,
		warm: { runtime: UnitRuntime; url: string }
	): Promise<BenchMeasurement[]> {
		const { coldSamples, warmIterations } = this.plan;
		const cold = Array.from({ length: coldSamples }, () => this.sample(target, run, warm.url));
		const steady = await benchSamples(warm.runtime, run.request, warmIterations);
		const entry = (metric: string, unitOfMeasure: string, value: number, samples: number) =>
			benchMeasurement(this.context, {
				target,
				metric,
				unitOfMeasure,
				value,
				method: metric === 'latency-cold-ms' ? coldMethod(samples) : warmMethod(samples),
				workload: run.id,
				samples
			});
		return [
			entry('latency-cold-ms', 'ms', median(cold), coldSamples),
			entry('latency-warm-ms', 'ms', steady.medianMs, warmIterations),
			entry('throughput-ops', 'ops/s', steady.opsPerSecond, warmIterations)
		];
	}

	/** One cold call in a fresh process, timed inside that process. */
	private sample(target: RuntimeKind, run: WorkloadRun, url: string): number {
		const [command, ...prefix] = this.plan.cli;
		const args = ['kernel', 'sample', '--runtime', target, '--nodes', String(run.nodes)];
		const served = target === 'http' ? ['--url', url] : [];
		const result = spawnSync(command, [...prefix, ...args, '--seed', String(run.seed), ...served], {
			encoding: 'utf8',
			env: internal()
		});
		if (result.status !== 0) return fail(`Cold sample for ${target} failed: ${result.stderr}`);
		return (JSON.parse(result.stdout) as { elapsedMs: number }).elapsedMs;
	}

	private async memory(
		target: RuntimeKind,
		run: WorkloadRun,
		runtime: UnitRuntime
	): Promise<BenchMeasurement> {
		const base = { target, metric: 'memory-bytes', unitOfMeasure: 'bytes', workload: run.id };
		if (runtime instanceof WasmRuntimeAdapter) {
			const method = 'Linear memory size of the instantiated module after the warm loop.';
			return benchMeasurement(this.context, {
				...base,
				value: await runtime.memoryBytes(),
				method
			});
		}
		if (target === 'process' && this.artifacts.native) {
			const peak = peakMemory(this.artifacts.native, [], JSON.stringify(run.request));
			const value = 'bytes' in peak ? peak.bytes : peak;
			const method = 'Peak resident set size of one native process run, from /usr/bin/time.';
			return benchMeasurement(this.context, { ...base, value, method });
		}
		const unavailable =
			target === 'http'
				? 'Memory belongs to the serving process, not to the caller.'
				: 'In-process module memory cannot be attributed to one unit.';
		return benchMeasurement(this.context, {
			...base,
			value: { unavailable },
			method: 'Not measured.'
		});
	}
}

/** Benchmark plumbing is not user activity, so its child commands record no analytics. */
function internal(): Environment {
	return { ...process.env, HARNESS_ANALYTICS_DISABLED: '1' };
}

/** Starts this CLI as an HTTP kernel server and resolves with its URL. */
export function serveKernel(cli: string[]): Promise<{ url: string; stop(): void }> {
	const [command, ...prefix] = cli;
	const args = [...prefix, 'kernel', 'serve', '--port', '0', '--runtime', 'module'];
	const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'], env: internal() });
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.stdout.once('data', (chunk: Buffer) => {
			const { url } = JSON.parse(chunk.toString('utf8')) as { url: string };
			resolve({ url, stop: () => void child.kill() });
		});
	});
}
