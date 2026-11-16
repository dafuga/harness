import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { planAudit } from '../../src/services/verification-evidence/task-completion-service/planAudit';
import type { TaskCheck } from '../../src/services/verification-evidence/task-completion-service/planAudit.types';

const goal = 'Build a reporting dashboard for uploaded reports';

const completePlan = [
	'# Overview',
	'Build a reporting dashboard for uploaded reports and explain its user-facing scope.',
	'## Acceptance',
	'- Users can filter reports by date and status.',
	'- The dashboard shows the matching report count.',
	'## Dependencies',
	'Use the existing report API and authenticated user session.',
	'## Verification',
	'Verify filters, empty states, and report counts with representative seeded records.',
	'## Performance',
	'Measure a representative workload of 500 reports, recording response latency and peak memory usage.'
].join('\n');

const unfinishedPlan = completePlan
	.replace(
		'Measure a representative workload of 500 reports, recording response latency and peak memory usage.',
		'Measure it later.'
	)
	.concat('\n- TODO pick a target');

function failedIds(checks: TaskCheck[]): string[] {
	return checks.filter((check) => !check.passed).map((check) => check.id);
}

function metaFor(state: string) {
	return {
		unitId: 'service.task-completion-service-plan-audit',
		symbol: 'planAudit',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Accepts a complete plan with every check passing', () => {
	const checks = planAudit(completePlan, goal);

	expect(checks).toHaveLength(9);
	expect(failedIds(checks)).toEqual([]);
	recordExampleCases(metaFor('accepts-a-complete-plan-with-every-check-passing'), [
		{
			name: 'complete reporting plan passes all nine structural checks',
			input: { goal, proposal: completePlan },
			output: checks
		}
	]);
});

test('Flags placeholders and unmeasured performance in a plan', () => {
	const checks = planAudit(unfinishedPlan, goal);

	expect(failedIds(checks)).toEqual(['plan.placeholders', 'plan.performance-method']);
	recordExampleCases(metaFor('flags-placeholders-and-unmeasured-performance-in-a-plan'), [
		{
			name: 'TODO line and missing workload method fail their checks',
			input: { goal, proposal: unfinishedPlan },
			output: failedIds(checks)
		}
	]);
});

test('Flags a plan that does not address the stated request', () => {
	const mismatchedGoal = 'Migrate the billing ledger to a new currency service';
	const checks = planAudit(completePlan, mismatchedGoal);

	expect(failedIds(checks)).toEqual(['plan.request']);
	recordExampleCases(metaFor('flags-a-plan-that-does-not-address-the-stated-request'), [
		{
			name: 'unrelated goal words do not appear in the proposal',
			input: { goal: mismatchedGoal, proposal: completePlan },
			output: failedIds(checks)
		}
	]);
});
