import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deploymentEnvironments,
	deploymentSteps
} from '../../src/models/development-tooling/DeploymentValues';

test('lists supported deployment environments', () => {
	expect(deploymentEnvironments).toEqual(['dev', 'stage', 'preprod', 'prod']);
	recordExampleCases(
		{
			unitId: 'desktop.model.deployment-types',
			symbol: 'deploymentEnvironments',
			state: 'lists-supported-deployment-environments',
			evidence: 'examples-cases',
			file: 'lists-supported-deployment-environments.json'
		},
		[
			{
				name: 'supported deployment environments',
				input: {},
				output: deploymentEnvironments
			}
		]
	);
});

test('lists deployment steps in execution order', () => {
	expect(deploymentSteps).toEqual([
		{ id: 'preparing', title: 'Prepare source' },
		{ id: 'checking', title: 'Run checks' },
		{ id: 'building', title: 'Build source' },
		{ id: 'uploading', title: 'Deploy to Cloudflare' },
		{ id: 'verifying', title: 'Verify health' }
	]);
	recordExampleCases(
		{
			unitId: 'desktop.model.deployment-types',
			symbol: 'deploymentSteps',
			state: 'lists-deployment-steps-in-execution-order',
			evidence: 'examples-cases',
			file: 'lists-deployment-steps-in-execution-order.json'
		},
		[
			{
				name: 'ordered deployment steps and titles',
				input: {},
				output: deploymentSteps
			}
		]
	);
});
