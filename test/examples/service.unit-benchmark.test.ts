import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { UnitBenchmarkService } from '../../src/workflows/verification-evidence/run-budget/UnitBenchmarkService';

const manifest = {
	schemaVersion: 1,
	id: 'reports.component.evidence-grid',
	uid: 'u_k3w7qz2na5',
	kind: 'component',
	title: 'Evidence grid',
	responsibility: 'Renders verification evidence as a grid of captured results.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: ['src/reports/component/evidence-grid/runtime.ts'], symbols: ['invoke'] },
	contract: { origin: 'derived', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'src/reports/component/evidence-grid/runtime.ts',
		targets: [{ kind: 'module', entry: 'src/reports/component/evidence-grid/runtime.ts' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

test('Rejects a kind absent from the manifest targets', async () => {
	await withTempDir('unit-benchmark-no-target-', async (directory) => {
		const service = new UnitBenchmarkService(directory);
		const workload = {
			schemaVersion: 1,
			id: 'evidence-grid.render-small',
			request: { operation: 'render', input: { rows: 40 } },
			rounds: 1,
			iterations: 1
		};
		let error: unknown;
		try {
			await service.measure(manifest as never, workload as never, 'process');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('process');
		recordExampleCases(
			{
				unitId: 'service.unit-benchmark',
				symbol: 'measure',
				state: 'rejects-a-kind-absent-from-the-manifest-targets',
				evidence: 'examples-cases',
				file: 'rejects-a-kind-absent-from-the-manifest-targets.json'
			},
			[
				{
					name: 'process target is rejected when only module is declared',
					input: { unit: 'reports.component.evidence-grid', target: 'process' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
