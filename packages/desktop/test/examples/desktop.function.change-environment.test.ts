import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { changeEnvironment } from '../../src/utils/projects-sessions/changeEnvironment';

test('promotes each environment in order, stopping at preprod', () => {
	const dev = changeEnvironment('dev');
	const stage = changeEnvironment('stage');
	const preprod = changeEnvironment('preprod');
	const prod = changeEnvironment('prod');

	expect(dev).toEqual(['dev']);
	expect(stage).toEqual(['dev', 'stage']);
	expect(preprod).toEqual(['dev', 'stage', 'preprod']);
	expect(prod).toEqual(['dev', 'stage', 'preprod']);

	recordExampleCases(
		{
			unitId: 'desktop.function.change-environment',
			symbol: 'changeEnvironment',
			state: 'promotes-each-environment-in-order-stopping-at-preprod',
			evidence: 'examples-cases',
			file: 'promotes-each-environment-in-order-stopping-at-preprod.json'
		},
		[
			{ name: 'automatic destinations for dev', input: 'dev', output: dev },
			{ name: 'automatic destinations for stage', input: 'stage', output: stage },
			{ name: 'automatic destinations for preprod', input: 'preprod', output: preprod },
			{ name: 'automatic destinations for prod', input: 'prod', output: prod }
		]
	);
});

test('rejects an unsupported deployment environment', () => {
	let thrown: unknown;
	try {
		changeEnvironment('qa' as Parameters<typeof changeEnvironment>[0]);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'Unknown deployment environment.' });
	if (!(thrown instanceof Error)) throw new Error('Expected an unsupported environment error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.change-environment',
			symbol: 'changeEnvironment',
			state: 'rejects-an-unsupported-deployment-environment',
			evidence: 'examples-cases',
			file: 'rejects-an-unsupported-deployment-environment.json'
		},
		[
			{
				name: 'reject an unknown deployment target',
				input: 'qa',
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
