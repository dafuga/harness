import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { TaskCompletionService, taskCompletionInstructions } from '../../src/services/verification-evidence/TaskCompletionService';

const proposal = `# Evidence grid latency and memory plan

## Overview
Add a latency and memory evidence grid that shows each representative workload for the evidence grid view.

## Acceptance Criteria
- The grid lists every representative workload with its measured latency.
- The grid reports resident memory (RSS) beside each latency value.

## Dependencies
The grid reads the committed verification record through the existing evidence repository.

## Verification
Run the automated tests for the grid, then run harness task check against the committed source.

## Performance
Measure a representative workload with a declared scenario, recording latency and memory (RSS) for each grid cell. No runtime results are recorded until the code runs.`;

test('Accepts a substantive performance plan', () => {
	new TaskCompletionService('/unused-project-root').requirePlan(
		proposal,
		'Plan latency and memory evidence for the evidence grid'
	);
	expect(taskCompletionInstructions()).toHaveLength(4);
	recordExampleCases(
		{
			unitId: 'service.task-completion',
			symbol: 'requirePlan',
			state: 'accepts-a-substantive-performance-plan',
			evidence: 'examples-cases',
			file: 'accepts-a-substantive-performance-plan.json'
		},
		[
			{
				name: 'proposal covers acceptance and representative performance measurements',
				input: { proposal, goal: 'Plan latency and memory evidence for the evidence grid' },
				output: { accepted: true }
			}
		]
	);
});

test('Rejects a plan with no substantive sections', () => {
	let error: unknown;
	try {
		new TaskCompletionService('/unused-project-root').requirePlan('# TODO', 'Plan the evidence grid');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'service.task-completion',
			symbol: 'requirePlan',
			state: 'rejects-a-plan-with-no-substantive-sections',
			evidence: 'examples-cases',
			file: 'rejects-a-plan-with-no-substantive-sections.json'
		},
		[
			{
				name: 'unfinished proposal fails required section checks',
				input: { proposal: '# TODO', goal: 'Plan the evidence grid' },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
