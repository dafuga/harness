import type { Command } from 'commander';
import { fail } from '../core/errors';
import {
	kernelDefault,
	kernelParity,
	kernelSample,
	parityProblems,
	renderDefault,
	serveKernelRuntime
} from '../workflows/runKernel';
import { renderBench, runKernelBench } from '../workflows/runKernelBench';
import { kernelBoundary } from '../workflows/runKernelBoundary';

interface Flags {
	json?: boolean;
	quick?: boolean;
	boundary?: boolean;
	write?: boolean | string;
	measurements?: string;
	runtime: string;
	port: string;
	nodes: string;
	seed: string;
	url?: string;
}

const cli = (): string[] => [process.execPath, process.argv[1]];

export function registerKernelCommand(program: Command): void {
	const kernel = program
		.command('kernel')
		.description('Prove, measure and serve the impact kernel across its runtimes.');
	kernel
		.command('parity')
		.option('--json', 'Print structured results.')
		.description('Compare the built Wasm and native kernels with the TypeScript reference.')
		.action(async (flags: Flags) => {
			const report = await kernelParity();
			const problems = parityProblems(report);
			const summary = `Kernel parity ${report.status}: ${report.cases} cases per runtime.`;
			console.log(flags.json ? JSON.stringify(report, null, 2) : summary);
			if (problems.length > 0) fail(problems.join('\n'));
		});
	kernel
		.command('bench')
		.option('--quick', 'Fewer samples and no 10k workload.')
		.option('--boundary', 'Measure only the invocation boundary that verification gates on.')
		.option('--write [file]', 'Record the run; defaults to the profile file in the repository.')
		.option('--json', 'Print structured results.')
		.description('Measure every runtime on identical workloads and derive the default.')
		.action(async (flags: Flags) => {
			if (flags.boundary) {
				console.log(JSON.stringify(await kernelBoundary(), null, 2));
				return;
			}
			const benchmark = await runKernelBench({
				quick: flags.quick,
				write: flags.write,
				cli: cli()
			});
			console.log(flags.json ? JSON.stringify(benchmark, null, 2) : renderBench(benchmark));
		});
	kernel
		.command('default')
		.option('--measurements <file>', 'Judge a recorded benchmark instead of this machine.')
		.option('--json', 'Print structured results.')
		.description('Show which runtime the measurements select, and why.')
		.action((flags: Flags) => {
			const choice = kernelDefault(flags.measurements);
			console.log(flags.json ? JSON.stringify(choice, null, 2) : renderDefault(choice));
		});
	registerService(kernel);
}

function registerService(kernel: Command): void {
	kernel
		.command('serve')
		.option('--port <port>', 'Loopback port; 0 picks a free one.', '0')
		.option('--runtime <kind>', 'Runtime to serve: module, wasm or process.', 'module')
		.description('Serve the kernel over loopback HTTP as an independently running unit.')
		.action(async (flags: Flags) => {
			const served = await serveKernelRuntime(flags.runtime, Number(flags.port));
			console.log(JSON.stringify({ url: served.url }));
		});
	kernel
		.command('sample')
		.requiredOption('--runtime <kind>', 'Runtime to sample.')
		.option('--nodes <count>', 'Workload size.', '1000')
		.option('--seed <seed>', 'Workload seed.', '7')
		.option('--url <url>', 'Served kernel, for the http runtime.')
		.description('Time one cold call in this fresh process; used by kernel bench.')
		.action(async (flags: Flags) => {
			const { runtime, url } = flags;
			const sample = await kernelSample({
				runtime,
				url,
				nodes: Number(flags.nodes),
				seed: Number(flags.seed)
			});
			console.log(JSON.stringify(sample));
		});
}
