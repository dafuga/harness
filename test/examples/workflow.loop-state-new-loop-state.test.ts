import { test } from 'vitest';
import { newLoopState } from '../../src/cli/program/manage-loop/newLoopState';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type Input = {
	name: string;
	goal: string;
	createdAt: string;
	kind?: 'coding' | 'planning';
	plan?: string;
};

const inputs: Input[] = [
	{
		name: 'fix-login-redirect',
		goal: 'Stop the login page from redirecting back to itself after sign-in.',
		createdAt: '2026-11-15T08:05:00.000Z'
	},
	{
		name: 'csv-export-plan',
		goal: 'Plan a CSV export for the orders report.',
		createdAt: '2026-11-15T10:12:45.318Z',
		kind: 'planning',
		plan: 'src/services/csv-export/plan.json'
	},
	{
		name: 'fix-checkout-totals',
		goal: 'Correct the tax rounding in the checkout summary.',
		createdAt: '2026-11-15T09:30:00.000Z',
		kind: 'coding'
	}
];

async function buildCases() {
	const cases = [];
	for (const input of inputs) {
		const state = await newLoopState('/workspace/acme-api', input);
		cases.push({
			name: input.name,
			input,
			output: {
				name: state.name,
				goal: state.goal,
				createdAt: state.createdAt,
				updatedAt: state.updatedAt,
				...(state.completion ? { completion: state.completion } : {}),
				steps: state.steps
			}
		});
	}
	return cases;
}

test('Adds completion only when a task kind is requested', async () => {
	const cases = await buildCases();
	expect(cases[0]?.output).toMatchObject({
		name: 'fix-login-redirect',
		updatedAt: inputs[0].createdAt,
		steps: []
	});
	expect(cases[0]?.output).not.toHaveProperty('completion');
	expect(cases[1]?.output).toMatchObject({
		completion: { version: 1, kind: 'planning', plan: 'src/services/csv-export/plan.json' }
	});
	expect(cases[2]?.output).toMatchObject({ completion: { version: 1, kind: 'coding' } });
	recordExampleCases(
		{
			unitId: 'workflow.loop-state-new-loop-state',
			symbol: 'newLoopState',
			state: 'adds-completion-only-when-a-task-kind-is-requested',
			evidence: 'examples-cases',
			file: 'adds-completion-only-when-a-task-kind-is-requested.json'
		},
		cases
	);
});
