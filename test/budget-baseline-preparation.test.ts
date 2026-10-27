import type { Refusal } from './budget-baseline-preparation.test.types';
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { baselineRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';
import { budgetSources, prepareBudgetFixture } from './support/budgetFixture';

/** Prepares a baseline, keeping each actual verification; `starve` empties the second one. */
async function prepare(starve: boolean) {
	const seen: { repo?: VerifyRepo; outcomes: VerifyOutcome[] } = { outcomes: [] };
	const result = await baselineRepo(
		async (repo) => {
			seen.repo = repo;
			const verify = repo.verify;
			repo.verify = async (args, env = {}) => {
				const second = starve && seen.outcomes.length === 1;
				const outcome = await verify(args, second ? { ...env, FIXTURE_NO_BENCH: '1' } : env);
				seen.outcomes.push(outcome);
				return outcome;
			};
		},
		{ sources: budgetSources, omitScenarios: true, prepare: prepareBudgetFixture }
	).then(
		(repo) => ({ returned: repo }),
		(error: unknown) => ({ refused: error as Refusal })
	);
	return { seen, result };
}
const title = (outcome: VerifyOutcome) =>
	outcome.record.budgets.findings.find(
		(item) => item.unit === 'service.title' && item.metric.startsWith('latency')
	);

test('a prepared baseline whose second verification fails is refused, its failed record kept', async () => {
	const { seen, result } = await prepare(true);
	try {
		expect(seen.outcomes).toHaveLength(2);
		const second = seen.outcomes[1];
		expect(second.exitCode).toBe(1);
		expect(title(second)).toMatchObject({ status: 'missing-measurement', measured: null });
		expect(second.record.failures).toContainEqual(expect.stringContaining('service.title'));
		// The repository is not advertised as clean: it is refused with the record that failed.
		expect(Object.keys(result)).toEqual(['refused']);
		const refused = 'refused' in result ? result.refused : undefined;
		expect(refused?.outcome).toBe(second);
		expect(refused?.repo?.root).toBe(seen.repo?.root);
		expect(refused?.message).toContain(second.directory);
		for (const failure of second.record.failures) expect(refused?.message).toContain(failure);
		expect(existsSync(second.directory)).toBe(true);
	} finally {
		await seen.repo?.dispose();
	}
}, 180_000);

test('a valid prepared baseline is returned once its second verification passed', async () => {
	const { seen, result } = await prepare(false);
	try {
		expect(seen.outcomes).toHaveLength(2);
		expect(seen.outcomes[1].exitCode).toBe(0);
		expect(seen.outcomes[1].record.failures).toEqual([]);
		expect('returned' in result ? result.returned.root : undefined).toBe(seen.repo?.root);
	} finally {
		await seen.repo?.dispose();
	}
}, 180_000);
