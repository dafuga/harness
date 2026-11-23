import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	KernelBenchmarkService,
	serveKernel
} from '../../src/cli/program/run-kernel-bench/kernel-benchmark-service/KernelBenchmarkService';
import type {
	BenchPlan,
	WorkloadRun
} from '../../src/cli/program/run-kernel-bench/kernel-benchmark-service/KernelBenchmarkService.types';

const plan: BenchPlan = { cli: ['harness'], coldSamples: 5, warmIterations: 100 };
const context = { profile: 'macos-arm64', commit: '0123456789abcdef0123456789abcdef01234567' };

const workload: WorkloadRun = {
	id: 'graph-3',
	nodes: 3,
	seed: 42,
	request: {
		operation: 'impact',
		input: {
			base: {
				nodes: ['reports.component.evidence-grid', 'reports.component.kernel'],
				edges: [[0, 1]]
			},
			head: {
				nodes: [
					'reports.component.evidence-grid',
					'reports.component.kernel',
					'reports.test.evidence-grid'
				],
				edges: [
					[0, 1],
					[2, 0]
				]
			},
			changed: ['reports.component.evidence-grid'],
			uncertain: [],
			sinks: ['reports.test.evidence-grid']
		}
	}
};

const exitingServer = 'process.exit(3);';
const readyServer =
	"process.stdout.write(JSON.stringify({ url: 'http://127.0.0.1:4173' }) + '\\n'); process.stdin.resume();";

function writeFakeCli(directory: string, source: string): string[] {
	const script = join(directory, 'fake-harness.cjs');
	writeFileSync(script, source);
	return [process.execPath, script];
}

test('Describes a workload by node, edge and changed counts', async () => {
	const service = new KernelBenchmarkService(plan, context);
	const summary = service.describe(workload);
	expect(summary.id).toBe('graph-3');
	expect(summary.nodes).toBe(3);
	expect(summary.edges).toBe(1);
	expect(summary.changed).toBe(1);
	expect(summary.requestBytes).toBeGreaterThan(0);
	expect(summary.responseBytes).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'service.kernel-benchmark',
			symbol: 'describe',
			state: 'describes-a-workload-by-node-edge-and-changed-counts',
			evidence: 'examples-cases',
			file: 'describes-a-workload-by-node-edge-and-changed-counts.json'
		},
		[
			{
				name: 'graph-3 workload with one base edge and one changed node',
				input: workload,
				output: {
					id: summary.id,
					nodes: summary.nodes,
					edges: summary.edges,
					changed: summary.changed,
					byteCountsPositive: summary.requestBytes > 0 && summary.responseBytes > 0
				}
			}
		]
	);
});

test('Rejects when the kernel server exits before readiness', async () => {
	await withTempDir('kernel-bench-exit-', async (directory) => {
		const cli = writeFakeCli(directory, exitingServer);
		let error: unknown;
		try {
			await serveKernel(cli);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'service.kernel-benchmark',
				symbol: 'serveKernel',
				state: 'rejects-when-the-kernel-server-exits-before-readiness',
				evidence: 'examples-cases',
				file: 'rejects-when-the-kernel-server-exits-before-readiness.json'
			},
			[
				{
					name: 'fake CLI exits with code 3 before printing readiness JSON',
					input: { cli: ['node', 'fake-harness.cjs'] },
					error: { name: (error as Error).name }
				}
			]
		);
	});
});

test('Resolves the server url from its readiness output', async () => {
	await withTempDir('kernel-bench-ready-', async (directory) => {
		const cli = writeFakeCli(directory, readyServer);
		const served = await serveKernel(cli);
		try {
			expect(served.url).toBe('http://127.0.0.1:4173');
			recordExampleCases(
				{
					unitId: 'service.kernel-benchmark',
					symbol: 'serveKernel',
					state: 'resolves-the-server-url-from-its-readiness-output',
					evidence: 'examples-cases',
					file: 'resolves-the-server-url-from-its-readiness-output.json'
				},
				[
					{
						name: 'fake CLI prints a JSON readiness line with a url',
						input: { cli: ['node', 'fake-harness.cjs'] },
						output: { url: served.url }
					}
				]
			);
		} finally {
			served.stop();
		}
	});
});
