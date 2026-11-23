import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { Budget } from '../../src/services/execution-runtimes/resource-queue-service/resource-policy/resourcePolicy.types';

test('Accepts a resource budget shape', () => {
	const budget: Budget = { cpu: 2, memory: 4096 };
	expect(budget).toEqual({ cpu: 2, memory: 4096 });
	recordExampleCases(
		{
			unitId:
				'service.execution-runtimes-resource-queue-service-resource-policy-resource-policy-types',
			symbol: 'Budget',
			state: 'accepts-a-resource-budget-shape',
			evidence: 'examples-cases',
			file: 'accepts-a-resource-budget-shape.json'
		},
		[
			{
				name: 'CPU and memory limits form a budget value',
				input: { cpu: 2, memory: 4096 },
				output: { cpu: budget.cpu, memory: budget.memory }
			}
		]
	);
});
