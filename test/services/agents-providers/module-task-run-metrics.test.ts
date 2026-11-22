import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { createRunRecord } from '../../../src/services/agents-providers/module-task-analytics-service/modelRunRecord';
import type { RunOutcome } from '../../../src/services/agents-providers/module-task-analytics-service/modelRunRecord.types';
import { taskRunReport } from '../../../src/services/agents-providers/module-task-analytics-service/taskRunReport';

function run(model: string, index: number, outcome: RunOutcome, cause: string | null) {
	const id = `${model}-${index}`;
	return createRunRecord({
		source: 'harness',
		id,
		taskId: id,
		chainId: id,
		taskType: 'phase-4',
		project: '/fixture',
		provider: model.startsWith('claude') ? 'claude' : 'codex',
		model,
		effort: 'medium',
		finishedAt: `2026-11-19T12:00:0${index}Z`,
		outcome,
		attempt: 1,
		rejectionCause: cause
	});
}

test('per-model metrics separate machine and quota failures from the model quality rate', () => {
	const report = taskRunReport([
		run('claude-haiku-5-5', 0, 'failed', 'quota'),
		run('claude-haiku-5-5', 1, 'failed', 'quota'),
		run('claude-haiku-5-5', 2, 'abandoned', 'abandoned'),
		run('claude-haiku-5-5', 3, 'done', null),
		run('claude-haiku-5-5', 4, 'done', null),
		run('claude-haiku-5-5', 5, 'done', null),
		run('claude-haiku-5-5', 6, 'rejected', 'verification'),
		run('gpt-6-luna', 0, 'failed', 'scope'),
		run('gpt-6-luna', 1, 'done', null),
		run('gpt-6-luna', 2, 'pending_review', null)
	]);
	expect(report.runsByModel).toHaveLength(2);
	const [haiku, luna] = report.runsByModel;
	expect(haiku).toMatchObject({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		effort: 'medium',
		runs: 7,
		firstTry: 3,
		infraFailures: 3,
		infraFailuresByCause: { quota: 2, abandoned: 1 }
	});
	expect(haiku.firstTryRate).toBeCloseTo(3 / 7, 10);
	expect(haiku.firstTryRateWhenRan).toBeCloseTo(3 / 4, 10);
	expect(haiku.infraFailureRate).toBeCloseTo(3 / 7, 10);
	expect(luna).toMatchObject({ runs: 3, infraFailures: 0, infraFailuresByCause: {} });
	expect(luna.firstTryRate, 'a scope failure is the model, not the machine').toBe(0.5);
	expect(luna.firstTryRateWhenRan).toBe(0.5);
});
