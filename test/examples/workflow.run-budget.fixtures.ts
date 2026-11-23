import { unitId, runtimePath, manifest } from './workflow.run-budget.fixture';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	budgetBench,
	loadBudgets
} from '../../src/workflows/verification-evidence/run-budget/runBudget';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

export const evidence = 'examples-cases';

export function baselineEvent(unit: string, id: string) {
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

export function writeJson(root: string, path: string, value: unknown): void {
	const file = join(root, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(value));
}

export function seedProject(
	root: string,
	events = [baselineEvent(unitId, 'verify-budget-001')]
): void {
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

export const invalidBudgetCommandExample = async () => {
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
};
