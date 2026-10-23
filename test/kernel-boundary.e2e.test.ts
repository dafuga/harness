import type { Boundary } from './kernel-boundary.e2e.test.types';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { captureLineSchema } from '../src/core/verifyTypes';
import { runHarness } from './support/cli';

test('kernel bench --boundary measures the public invocation boundary and records it as evidence', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-boundary-'));
	const evidence = join(root, 'evidence');
	const quiet = await runHarness(['kernel', 'bench', '--boundary'], root, true, {
		HARNESS_EVIDENCE_DIR: evidence,
		TAKE_SCREENSHOT: '0'
	});
	const printed = JSON.parse(quiet.stdout) as Boundary;
	expect(printed.unit).toBe('service.unit-runtime');
	expect(printed.workload).toBe('graph-1k');
	await expect(readFile(join(evidence, 'captures.ndjson'), 'utf8')).rejects.toThrow();

	await runHarness(['kernel', 'bench', '--boundary'], root, true, {
		HARNESS_EVIDENCE_DIR: evidence,
		TAKE_SCREENSHOT: '1'
	});
	const lines = (await readFile(join(evidence, 'captures.ndjson'), 'utf8'))
		.trim()
		.split('\n')
		.map((line) => captureLineSchema.parse(JSON.parse(line)));
	expect(lines.map((line) => [line.evidence, line.kind, line.state])).toEqual([
		['boundary', 'benchmark', 'module'],
		['boundary', 'benchmark', 'wasm'],
		['boundary', 'benchmark', 'process']
	]);
	for (const line of lines) {
		const file = JSON.parse(await readFile(join(evidence, line.file), 'utf8')) as Boundary;
		const floor = file.measurements.find((item) => item.metric === 'latency-floor-ms');
		expect(floor).toMatchObject({
			unit: 'service.unit-runtime',
			target: line.state,
			workload: 'graph-1k'
		});
		expect(floor?.value).toBeGreaterThan(0);
		expect(floor?.samples).toBeGreaterThanOrEqual(200);
		expect(floor?.method).toMatch(/request validation, serialization and response parsing/);
		expect(floor?.comparison).toMatchObject({
			request: printed.measurements[0].comparison?.request,
			boundary: 'public-invocation',
			sampling: { warmup: 3, rounds: 5, iterations: 50 }
		});
		expect(floor?.comparison?.request).toMatch(/^[0-9a-f]{64}$/);
		expect(file.measurements.map((item) => item.metric)).toEqual([
			'latency-floor-ms',
			'latency-warm-ms',
			'throughput-ops'
		]);
	}
	await rm(root, { recursive: true, force: true });
}, 180_000);
