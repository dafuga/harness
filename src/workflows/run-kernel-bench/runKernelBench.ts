import { resolve } from "node:path";
import { GitAdapter } from "../../adapters/GitAdapter";
import { calibrationNote, representativeWorkload, type KernelBenchmark } from "../../core/benchmarkTypes";
import { fail } from "../../core/errors";
import { kernelContract } from "../../core/kernelTypes";
import { MeasurementRepository } from "../../repositories/MeasurementRepository";
import { KernelBenchmarkService, serveKernel, type WorkloadRun } from "../../services/kernel-benchmark-service/KernelBenchmarkService";
import { sizeMeasurements } from "./benchMeasurement";
import { chooseRuntime } from "../../utils/chooseRuntime";
import { kernelArtifacts } from "../../utils/kernelArtifacts";
import { kernelWorkload } from "../../utils/kernelWorkload";
import { machineProfile } from "../../utils/machineProfile";

export interface BenchOptions {
	root?: string;
	quick?: boolean;
	/** `true` writes the profile file in the repository; a string writes that file. */
	write?: boolean | string;
	cli: string[];
}

const seed = 7;

const sizes = [
	{ id: 'graph-100', nodes: 100 },
	{ id: representativeWorkload, nodes: 1000 },
	{ id: 'graph-10k', nodes: 10_000 }
];

/** Benchmarks the impact kernel in every runtime and derives the default from the result. */
export async function runKernelBench(options: BenchOptions): Promise<KernelBenchmark> {
	const root = resolve(options.root ?? process.cwd());
	const build = kernelArtifacts().build ?? fail('Build the kernel first: bun run build:kernel.');
	const profile = machineProfile();
	const source = await revision(root);
	const context = { profile: profile.id, commit: source.dirty ? null : source.commit };
	const plan = options.quick
		? { cli: options.cli, coldSamples: 3, warmIterations: 30 }
		: { cli: options.cli, coldSamples: 9, warmIterations: 200 };
	const service = new KernelBenchmarkService(plan, context);
	const runs: WorkloadRun[] = sizes
		.slice(0, options.quick ? 2 : 3)
		.map((size) => ({ ...size, seed, request: kernelWorkload(size.nodes, seed) }));
	const server = await serveKernel(options.cli);
	const measurements = sizeMeasurements(context, build);
	try {
		for (const run of runs) measurements.push(...(await service.measure(run, server.url)));
	} finally {
		server.stop();
	}
	const benchmark: KernelBenchmark = {
		schemaVersion: 1,
		contract: kernelContract,
		recordedAt: new Date().toISOString(),
		profile,
		source,
		provenance: { kind: 'calibration', verified: false, note: calibrationNote },
		workloads: runs.map((run) => service.describe(run)),
		measurements,
		default: chooseRuntime({ measurements, workload: representativeWorkload, profile: profile.id })
	};
	if (options.write) {
		const file = typeof options.write === 'string' ? options.write : undefined;
		await new MeasurementRepository(root).write(benchmark, file);
	}
	return benchmark;
}

async function revision(root: string): Promise<KernelBenchmark['source']> {
	const git = new GitAdapter(root);
	const commit = (await git.attempt(['rev-parse', '--verify', '--quiet', 'HEAD'])) ?? null;
	const status = commit ? await git.attempt(['status', '--porcelain']) : '';
	return {
		commit: commit && /^[0-9a-f]{40}$/.test(commit) ? commit : null,
		dirty: Boolean(status)
	};
}

export function renderBench(benchmark: KernelBenchmark): string {
	const value = (target: string, metric: string, workload: string) => {
		const found = benchmark.measurements.find(
			(item) => item.target === target && item.metric === metric && item.workload === workload
		);
		return found?.value === null || found === undefined ? 'n/a' : found.value.toFixed(3);
	};
	const rows = benchmark.workloads.flatMap((workload) =>
		['module', 'wasm', 'process', 'http'].map(
			(target) =>
				`  ${workload.id.padEnd(10)} ${target.padEnd(8)} cold ${value(target, 'latency-cold-ms', workload.id)} ms` +
				`  warm ${value(target, 'latency-warm-ms', workload.id)} ms` +
				`  ${value(target, 'throughput-ops', workload.id)} ops/s`
		)
	);
	const { runtime, basis, workload } = benchmark.default;
	const tree = benchmark.source.dirty ? 'an uncommitted tree, no tested revision' : 'a clean tree';
	return [
		`Impact kernel benchmark on ${benchmark.profile.cpu} (${benchmark.profile.runtime}).`,
		...rows,
		`Default: ${runtime} (${basis} on ${workload}). ${benchmark.default.rule}`,
		`Provenance: calibration from ${tree}; not verification evidence or a budget baseline.`
	].join('\n');
}
