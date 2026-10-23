import type { PerformanceEntry } from './rankRepo.types';
import { rankScenario, rankSource, rankWorkload } from './verifyFixture';
import { baselineRepo, type VerifyOutcome, type VerifyRepo } from './verifyRepo';

export const rankWorkloadPath = 'specification/workloads/rank-20k.json';

/** The baseline fixture plus a real operation with a frozen end-to-end latency budget. */
export function rankBaselineRepo(): Promise<VerifyRepo> {
	return baselineRepo(async (repo) => {
		await repo.write('src/utils/rank.ts', rankSource);
		await repo.write(rankWorkloadPath, JSON.stringify(rankWorkload));
		await repo.write('specification/scenarios/rank-boundary.json', JSON.stringify(rankScenario));
		await repo.harness(['units', 'index', '--write']);
		const path = 'specification/units/function.rank.json';
		const manifest = await repo.json<{ budgets: object }>(path);
		const module = { kind: 'module', entry: 'src/utils/rank.ts', handler: 'rank' };
		const performance = [{ workload: 'rank-20k', metric: 'latency-floor-ms', tolerance: 0.05 }];
		await repo.write(
			path,
			JSON.stringify({
				...manifest,
				runtime: { ...module, targets: [module] },
				budgets: { ...manifest.budgets, performance }
			})
		);
		await repo.harness(['units', 'index', '--write']);
	});
}

/** The latency finding of one unit in a verification outcome. */
export function latencyFinding(outcome: VerifyOutcome, unit: string) {
	return outcome.record.budgets.findings.find(
		(item) => item.unit === unit && item.metric.startsWith('latency')
	);
}

/** Rewrites the committed workload under its unchanged name and commits the change. */
export async function changeWorkload(
	repo: VerifyRepo,
	edit: (workload: typeof rankWorkload) => object
): Promise<string> {
	await repo.write(rankWorkloadPath, JSON.stringify(edit(rankWorkload)));
	await repo.harness(['units', 'index', '--write']);
	return repo.commit('feat: change the workload under the same name');
}

export async function performanceHistory(
	repo: VerifyRepo,
	unit: string
): Promise<Array<{ type: string; performance: PerformanceEntry[] }>> {
	const history = await repo.run(['budget', 'history', unit, '--json']);
	return JSON.parse(history.stdout) as Array<{ type: string; performance: PerformanceEntry[] }>;
}

export type { PerformanceEntry } from './rankRepo.types';
