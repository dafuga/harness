import type { Input, Runner } from './measureHarness.types';
import { apiMeasuredUnits, apiWorkloadArgs } from './apiMeasuredUnits';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { evidenceRequested, recordCapture } from '../../../src/utils/record-capture/recordCapture';
import type { CommandResult } from '../cli';

/** Observe successful standard CLI workloads without changing their output or verification context. */
export async function measureHarness(input: Input, run: Runner): Promise<CommandResult> {
	const units = measuredUnits(input.args).filter((unit) =>
		existsSync(join(input.source, 'specification/units', unit + '.json'))
	);
	if (!evidenceRequested() || !units.length)
		return run(input.command, input.cwd, input.expectSuccess, input.env);
	if (!existsSync('/usr/bin/time'))
		throw new Error('No process usage collector is available for the required CLI workload.');
	const directory = await mkdtemp(join(tmpdir(), 'harness-cli-usage-'));
	const usage = join(directory, 'usage.txt');
	try {
		const start = performance.now();
		const result = await run(
			['/usr/bin/time', process.platform === 'darwin' ? '-l' : '-v', '-o', usage, ...input.command],
			input.cwd,
			input.expectSuccess,
			input.env
		);
		const duration = performance.now() - start;
		if (result.exitCode === 0 || input.args[0] === 'validate')
			recordUsage(units, measurementArguments(input.args), duration, await readFile(usage, 'utf8'));
		return result;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function measuredUnits(args: string[]): string[] {
	if (args[0] === 'api') return apiMeasuredUnits(args);
	if (args[0] === 'validate')
		return [
			'command.development-tooling-validate',
			'service.git-source-history-module-data',
			'repository.git-source-history-module-data',
			'validator.development-tooling-module-data',
			'entry.program',
			'entry.index'
		];
	const workload = measuredWorkloads[args.slice(0, 2).join(':')];
	if (workload) return workload;
	if (args[0] === 'new') return ['template.project-guidance'];
	if (args[0] === 'history' && args[1] === 'build')
		return [
			'service.revision-detail',
			'function.regression-history',
			'repository.regression-proof'
		];
	if (args[0] !== 'loop' || args[1] !== 'record') return [];
	const units = [
		'function.record-regression',
		'service.regression-proof',
		'repository.regression-proof',
		'function.regression-types'
	];
	return args[args.indexOf('--phase') + 1] === 'green'
		? [...units, 'function.regression-history']
		: units;
}

// These units execute in the native-fixture run. Figures describe the complete CLI workload.
const benchmarkRunUnits = [
	'command.benchmark',
	'service.benchmark',
	'adapter.codex-benchmark',
	'adapter.claude-benchmark',
	'repository.benchmark',
	'validator.benchmark-definition',
	'function.benchmark-events',
	'function.benchmark-process',
	'workflow.benchmark-definition',
	'workflow.benchmark-evaluate',
	'workflow.benchmark-metrics',
	'workflow.benchmark-trial',
	'workflow.benchmark-workspace',
	'workflow.run-benchmark',
	'function.command-action',
	'entry.program',
	'entry.index'
];

const measuredWorkloads: Record<string, string[]> = {
	'info:resources': ['guide.resources', 'guide.guide', 'entry.program', 'entry.index'],
	'resources:status': [
		'command.resources',
		'service.resource-queue',
		'service.resource-monitor',
		'adapter.host-resources',
		'function.host-memory',
		'function.host-resource-limits',
		'function.resource-cpu',
		'function.resource-config',
		'function.resource-database',
		'repository.resource-queue',
		'function.resource-types',
		'entry.program',
		'entry.index',
		'function.command-action'
	],
	'resources:run': [
		'command.resources',
		'service.resource-queue',
		'service.resource-monitor',
		'adapter.host-resources',
		'function.host-memory',
		'function.host-resource-limits',
		'function.resource-cpu',
		'function.resource-config',
		'function.resource-database',
		'repository.resource-queue',
		'function.resource-types',
		'function.resource-policy',
		'function.resource-context',
		'function.resource-command',
		'function.resource-request',
		'function.resource-identity',
		'function.resource-workers',
		'function.isolated-child',
		'function.run-isolated',
		'entry.program',
		'entry.index',
		'function.command-action'
	],
	'verify:run': [
		'command.verify',
		'workflow.run-verify',
		'service.check-run',
		'function.resource-work'
	],

	'info:benchmark': ['guide.benchmark', 'guide.guide', 'entry.program', 'entry.index'],
	'benchmark:run': benchmarkRunUnits,
	'analytics:benchmarks': [
		'command.analytics',
		'service.analytics',
		'workflow.analytics-metrics',
		'entry.program',
		'entry.index'
	]
};

function recordUsage(units: string[], args: string[], duration: number, usage: string): void {
	const resident =
		process.platform === 'darwin'
			? /^\s*(\d+)\s+maximum resident set size/m.exec(usage)
			: /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(usage);
	if (!resident) throw new Error('The CLI workload did not report peak RSS.');
	const memory = Number(resident[1]) * (process.platform === 'darwin' ? 1 : 1024);
	const phase = args.includes('--phase') ? args[args.indexOf('--phase') + 1] : '';
	const workload = [args[0], args[1], phase].filter(Boolean).join('-');
	const measurements = units.flatMap((unit) => {
		const context = { unit, workload, target: 'process', samples: 1 };
		return [
			{
				...context,
				metric: 'latency-cli-ms',
				unitOfMeasure: 'ms',
				value: duration,
				method:
					'Wall time of one cold CLI workload including startup, snapshots and shared code; no isolated-unit attribution or warmup.'
			},
			{
				...context,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: memory,
				method:
					'Maximum RSS of the whole CLI process including shared runtime; not isolated unit memory or the sum of child processes.'
			}
		];
	});
	recordCapture(
		{
			evidence: 'cli-benchmarks',
			kind: 'benchmark',
			state: 'cli-workload',
			file: 'cli-' + randomUUID() + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}

function measurementArguments(args: string[]): string[] {
	if (args[0] === 'api') return apiWorkloadArgs(args);
	if (args[0] === 'validate') {
		if (args.includes('--history')) return ['validate', 'history'];
		return ['validate', args.includes('--write') ? 'write' : 'read'];
	}
	return args;
}
