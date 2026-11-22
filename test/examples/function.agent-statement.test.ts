import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { agentStatement } from '../../src/services/agents-providers/agent-activity-service/agentStatement';
import type { AgentInput } from '../../src/utils/agents-providers/agentStatement';

test('Normalizes owner supplied agent facts', () => {
	const supplied = {
		id: 'agent-42',
		label: '  Index migration  ',
		provider: 'openai',
		model: 'gpt-6-luna',
		task: 'Review agent activity metadata',
		loop: 'contract-review',
		units: 'workflow.run-activity,function.agent-statement,workflow.run-activity',
		pid: '4312',
		ttl: '1800',
		outcome: 'Validated activity metadata'
	} satisfies AgentInput;
	const defaults = {} satisfies AgentInput;
	const normalized = agentStatement(supplied);
	const defaulted = agentStatement(defaults);

	expect(normalized).toEqual({
		id: 'agent-42',
		label: 'Index migration',
		provider: 'openai',
		model: 'gpt-6-luna',
		task: 'Review agent activity metadata',
		loop: 'contract-review',
		units: ['function.agent-statement', 'workflow.run-activity'],
		pid: 4312,
		ttlSeconds: 1800,
		outcome: 'Validated activity metadata'
	});
	expect(defaulted).toEqual({ pid: null, ttlSeconds: 900 });
	recordExampleCases(
		{
			unitId: 'function.agent-statement',
			symbol: 'agentStatement',
			state: 'normalizes-owner-supplied-agent-facts',
			evidence: 'examples-cases',
			file: 'normalizes-owner-supplied-agent-facts.json'
		},
		[
			{
				name: 'trims text, sorts and deduplicates units, and parses numeric fields',
				input: supplied,
				output: normalized
			},
			{ name: 'omitted facts use pid and ttl defaults', input: defaults, output: defaulted }
		]
	);
});

test('Throws ExpectedCliError when the supplied id is invalid', () => {
	const input = { id: 'agent with spaces' } satisfies AgentInput;
	const error = '--id must be letters, digits, dots, dashes or underscores, 64 at most.';
	expect(() => agentStatement(input)).toThrow(error);
	recordExampleCases(
		{
			unitId: 'function.agent-statement',
			symbol: 'agentStatement',
			state: 'throws-expectedclierror-when-the-supplied-id-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-the-supplied-id-is-invalid.json'
		},
		[{ name: 'rejects an id containing spaces', input, error }]
	);
});
