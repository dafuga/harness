import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { builtInTemplates } from '../../src/workflows/development-tooling/loop-templates/builtInLoopTemplates';

test('Lists the six built-in loop templates', () => {
	const ids = builtInTemplates.map((template) => template.id);
	expect(ids).toEqual([
		'feature',
		'fix',
		'refactor',
		'visual-change',
		'bug-fix',
		'regression-prevention'
	]);
	expect(builtInTemplates[0]).toMatchObject({
		id: 'feature',
		title: 'Feature Delivery',
		steps: [
			{ id: 'spec' },
			{ id: 'implement' },
			{ id: 'test' },
			{ id: 'verify' }
		],
		evaluators: [{ id: 'check', command: 'bun run check', step: 'verify' }]
	});
	recordExampleCases(
		{
			unitId: 'workflow.built-in-loop-templates',
			symbol: 'builtInTemplates',
			state: 'lists-the-six-built-in-loop-templates',
			evidence: 'examples-cases',
			file: 'lists-the-six-built-in-loop-templates.json'
		},
		[
			{
				name: 'exports the six built-in template ids and feature verification steps',
				input: {},
				output: {
					ids,
					feature: {
						title: builtInTemplates[0].title,
						steps: builtInTemplates[0].steps.map((step) => step.id),
						evaluators: builtInTemplates[0].evaluators
					}
				}
			}
		]
	);
});
