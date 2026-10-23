import { afterAll, expect, test } from 'vitest';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';
import { unitIdentity } from '../../src/utils/classify-path/unitIdentity';

test('unitIdentity derives kind and name from Harness scaffold folders', () => {
	const cases: Array<[string, string]> = [
		['src/services/AnalyticsService.ts', 'service.analytics'],
		['src/utils/commandAction.ts', 'function.command-action'],
		['src/core/files.ts', 'function.files'],
		['src/audit/adapters/cpp.ts', 'audit.adapters-cpp'],
		['src/components/EvidenceGrid.svelte', 'component.evidence-grid'],
		[
			'src/components/entity-contract/serviceMethods.ts',
			'function.entity-contract-service-methods'
		],
		['src/components/entity-contract/store.svelte.ts', 'function.entity-contract-store'],
		['src/routes/+page.svelte', 'page.root'],
		['src/routes/+page.server.ts', 'page.root'],
		['src/routes/reports/[id]/+page.svelte', 'page.reports-id'],
		['src/routes/+layout.svelte', 'layout.root'],
		['src/routes/api/reports/[id]/+server.ts', 'endpoint.api-reports-id'],
		['src/lib/styles/base.css', 'style.base'],
		['src/index.ts', 'entry.index'],
		['scripts/build-picker.ts', 'script.build-picker'],
		['db/seed-data/analytics-e2e.ts', 'seeder.analytics-e2e']
	];
	for (const [path, id] of cases) expect(unitIdentity(path)?.id).toBe(id);
});

test('unitIdentity prefixes named workspaces and skips tests and unknown files', () => {
	expect(unitIdentity('src/services/ReportExportService.ts', 'reports')?.id).toBe(
		'reports.service.report-export'
	);
	expect(unitIdentity('test/services/analytics.test.ts')).toBeUndefined();
	expect(unitIdentity('README.md')).toBeUndefined();
});

/** Classify representative visual, support, service and route paths without filesystem I/O. */
afterAll(() => {
	if (!evidenceRequested()) return;
	const paths = [
		'src/components/EvidenceGrid.svelte',
		'src/components/entity-contract/serviceMethods.ts',
		'src/routes/+layout.ts',
		'src/routes/+page.svelte',
		'src/services/ReportExportService.ts'
	];
	const samples: number[] = [];
	let checksum = 0;
	for (let round = 0; round < 6; round++) {
		const started = performance.now();
		for (let iteration = 0; iteration < 1000; iteration++)
			for (const path of paths) checksum += unitIdentity(path, 'reports')?.id.length ?? 0;
		if (round > 0) samples.push((performance.now() - started) / (1000 * paths.length));
	}
	expect(checksum).toBeGreaterThan(0);
	const common = {
		unit: 'function.unit-identity',
		callable: 'unitIdentity',
		workload: 'visual-and-nonvisual-source-paths',
		target: 'module',
		samples: 25000
	};
	const measurements = [
		{
			...common,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: samples.sort((a, b) => a - b)[2],
			method:
				'Median per call from five batches of 1000 passes over five standard source paths after one warmup. Returned identities are consumed; filesystem and source parsing are excluded.'
		},
		{
			...common,
			samples: 1,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().heapUsed,
			method:
				'Used JavaScript heap of the whole Vitest worker after the classification workload; includes the test runner and shared code, not isolated classifier allocation.'
		}
	];
	recordCapture(
		{
			evidence: 'unit-identity-benchmark',
			state: 'source-path-kinds',
			kind: 'benchmark',
			file: 'unit-identity-benchmark.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
});
