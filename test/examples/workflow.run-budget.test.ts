import { unitId, runtimePath, manifest } from './workflow.run-budget.fixture';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import {
	budgetBench,
	budgetHistory,
	budgetMeasure,
	budgetStatus,
	loadBudgets
} from '../../src/workflows/verification-evidence/run-budget/runBudget';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
const evidence = 'examples-cases';

function baselineEvent(unit: string, id: string) {
	return {
		type: 'baseline',
		unit,
		record: { id, commit: 'a'.repeat(40), tree: 'b'.repeat(40) },
		reviewer: 'Fixture Reviewer',
		reason: 'Example reviewed baseline',
		at: '2026-11-15T12:00:00.000Z',
		metrics: { 'source-bytes': 120, complexity: 1, dependencies: 0 },
		performance: []
	};
}

function writeJson(root: string, path: string, value: unknown): void {
	const file = join(root, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(value));
}

function seedProject(root: string, events = [baselineEvent(unitId, 'verify-budget-001')]): void {
	const runtimeFile = join(root, runtimePath);
	mkdirSync(dirname(runtimeFile), { recursive: true });
	writeFileSync(
		runtimeFile,
		'export function invoke(request: { operation: string; input?: unknown }) { return { ok: true, output: { operation: request.operation, input: request.input ?? null } }; }\n'
	);
	writeJson(root, 'specification/units/workflow.run-budget.json', manifest);
	if (events.length > 0) {
		const ledger = join(root, 'specification/budgets/ledger.ndjson');
		mkdirSync(dirname(ledger), { recursive: true });
		writeFileSync(ledger, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
	}
}

async function thrownMessage(action: () => Promise<unknown>): Promise<string> {
	try {
		await action();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	return 'No error was thrown';
}

test('loads manifests, ledger events, and baselines', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		const events = [
			baselineEvent(unitId, 'verify-budget-001'),
			baselineEvent('function.rank', 'verify-budget-002')
		];
		seedProject(root, events);
		const loaded = await loadBudgets(root);
		const output = {
			manifestIds: loaded.manifests.map(({ id }) => id),
			eventUnits: loaded.events.map(({ unit }) => unit),
			baselineUnits: [...loaded.baselines.keys()]
		};
		expect(loaded.root).toBe(root);
		expect(output).toEqual({
			manifestIds: [unitId],
			eventUnits: [unitId, 'function.rank'],
			baselineUnits: [unitId, 'function.rank']
		});
		recordExampleCases(
			{
				unitId,
				symbol: 'loadBudgets',
				state: 'loads-manifests-ledger-events-and-baselines',
				evidence,
				file: 'loads-manifests-ledger-events-and-baselines.json'
			},
			[{ name: 'one active manifest and two reviewed ledger events', input: { root }, output }]
		);
	});
});

test('measures one active unit from source files', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		seedProject(root);
		const rows = await budgetMeasure(unitId, root);
		const output = rows.map(({ metric, value, unitOfMeasure, unavailable, partial, target }) => ({
			metric,
			value,
			unitOfMeasure,
			target: target ?? null,
			unavailable: unavailable ?? null,
			partial: partial ?? null
		}));
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((row) => row.unit === unitId)).toBe(true);
		expect(rows.find((row) => row.metric === 'source-bytes')?.value).toBeGreaterThan(0);
		recordExampleCases(
			{
				unitId,
				symbol: 'budgetMeasure',
				state: 'measures-one-active-unit-from-source-files',
				evidence,
				file: 'measures-one-active-unit-from-source-files.json'
			},
			[
				{
					name: 'filter to the active workflow in a temporary source tree',
					input: { unit: unitId, root },
					output
				}
			]
		);
	});
});

test('filters ledger history by exact unit id', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		seedProject(root, [
			baselineEvent(unitId, 'verify-budget-001'),
			baselineEvent('function.rank', 'verify-budget-002')
		]);
		const filtered = await budgetHistory(unitId, root);
		const all = await budgetHistory(undefined, root);
		expect(filtered.map(({ unit }) => unit)).toEqual([unitId]);
		expect(all.map(({ unit }) => unit)).toEqual([unitId, 'function.rank']);
		recordExampleCases(
			{
				unitId,
				symbol: 'budgetHistory',
				state: 'filters-ledger-history-by-exact-unit-id',
				evidence,
				file: 'filters-ledger-history-by-exact-unit-id.json'
			},
			[
				{
					name: 'history restricted to the workflow unit',
					input: { unit: unitId, root },
					output: filtered.map(({ type, unit }) => ({ type, unit }))
				},
				{
					name: 'history without a unit filter',
					input: { root },
					output: all.map(({ type, unit }) => ({ type, unit }))
				}
			]
		);
	});
});

test('reports baseline and measurement status', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		seedProject(root);
		const status = await budgetStatus(root);
		expect(status).toEqual({ baselined: 1, inherited: [], unbaselined: [], unmeasured: [] });
		recordExampleCases(
			{
				unitId,
				symbol: 'budgetStatus',
				state: 'reports-baseline-and-measurement-status',
				evidence,
				file: 'reports-baseline-and-measurement-status.json'
			},
			[{ name: 'one active unit with a reviewed baseline', input: { root }, output: status }]
		);
	});
});

test('benchmarks a module workload and records a capture', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		seedProject(root, []);
		const workload = 'specification/workloads/run-budget-smoke.json';
		writeJson(root, workload, {
			schemaVersion: 1,
			id: 'workflow.run-budget.smoke',
			request: { operation: 'echo', input: { message: 'hello' } },
			rounds: 1,
			iterations: 1
		});
		const input = {
			unit: unitId,
			workload,
			target: 'module',
			evidence: 'examples-benchmark',
			state: 'benchmarks-a-module-workload-and-records-a-capture'
		};
		const result = await budgetBench(input, root);
		const output = {
			unit: result.unit,
			workload: result.workload,
			target: result.target,
			responseDigest: result.responseDigest,
			measurements: result.measurements.map(
				({ metric, value, unitOfMeasure, target, samples }) => ({
					metric,
					value,
					unitOfMeasure,
					target,
					samples
				})
			)
		};
		expect(result).toMatchObject({
			unit: unitId,
			workload: 'workflow.run-budget.smoke',
			target: 'module'
		});
		expect(result.responseDigest).toMatch(/^[a-f0-9]{64}$/);
		expect(result.measurements.length).toBeGreaterThan(0);
		recordExampleCases(
			{
				unitId,
				symbol: 'budgetBench',
				state: 'benchmarks-a-module-workload-and-records-a-capture',
				evidence,
				file: 'benchmarks-a-module-workload-and-records-a-capture.json'
			},
			[{ name: 'one round through the declared module handler', input: { ...input, root }, output }]
		);
	});
});

test('throws ExpectedCliError for invalid requests and ledger data', async () => {
	await withTempDir('workflow-run-budget-', async (root) => {
		seedProject(root);
		writeFileSync(join(root, 'specification/budgets/ledger.ndjson'), '{bad json}\n');
		const ledgerError = await thrownMessage(() => loadBudgets(root));
		writeJson(root, 'specification/workloads/invalid.json', {});
		const requestError = await thrownMessage(() =>
			budgetBench({ unit: unitId, workload: 'specification/workloads/invalid.json' }, root)
		);
		expect(ledgerError).toContain('budget ledger line 1 is malformed');
		expect(requestError).toContain('is not a workload');
		recordExampleCases(
			{
				unitId,
				symbol: 'loadBudgets/budgetBench',
				state: 'throws-expectedclierror-for-invalid-requests-and-ledger-data',
				evidence,
				file: 'throws-expectedclierror-for-invalid-requests-and-ledger-data.json'
			},
			[
				{
					name: 'malformed ledger and invalid workload inputs',
					input: { root },
					output: { ledgerError, requestError }
				}
			]
		);
	});
});
